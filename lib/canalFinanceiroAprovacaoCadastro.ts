import type { SupabaseClient } from '@supabase/supabase-js'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { resolverEcoCanaisDaEmpresa, resolverEcoCanaisDoProfissional } from '@/lib/ecoCanaisPorCidade'
import {
  ASSUNTO_CONVERSA_APROVACAO_CADASTRO,
  abrirConversaFinanceiroAdm,
  buscarConversaAbertaParaAlvo,
  encerrarConversaFinanceiro,
  enviarMensagemConversaFinanceiro,
} from '@/lib/financeiroConversas'

export const TITULO_CADASTRO_LIBERADO_RELATORIOS = 'PARÁBENS'

export const MENSAGEM_CADASTRO_LIBERADO_RELATORIOS =
  'seu cadastro foi liberado, escolha um plano (na terceira aba) para utilizar todos os benefícios do aplicativo.'

export const VARIANT_CADASTRO_LIBERADO_PLANOS = 'cadastro_liberado_planos'

export function montarMensagemAprovacaoCadastro(nomeUsuario: string): string {
  const handle = nomeUsuario.trim().replace(/^@+/, '')
  const user = handle ? `@${handle}` : '@usuario'
  return `Bem-Vindo ${user},

Sua documentação foi checada e está tudo em ordem, seu cadastro em nosso ecossistema foi aprovado e os benefícios da sua categoria já estão liberados para você.

Desejamos um bom uso do aplicativo e torcemos para você fazer bons negócios com a 3F, nossa ferramenta de trabalho.

Atenciosamente, Grupo Cacique`
}

async function resolverEcossistemaIdsDoAlvo(
  supabase: SupabaseClient,
  tipo: 'profissional' | 'empresa',
  usuarioId: string,
): Promise<string[]> {
  const bloco =
    tipo === 'empresa'
      ? await resolverEcoCanaisDaEmpresa(supabase, { usuarioId })
      : await resolverEcoCanaisDoProfissional(supabase, { usuarioId })
  return bloco?.id ? [bloco.id] : []
}

export async function buscarAdmUsuarioParaMensageiroFinanceiro(
  supabase: SupabaseClient,
  opts?: { empresaId?: string | null; preferUsuarioId?: string | null },
): Promise<string | null> {
  const prefer = opts?.preferUsuarioId != null ? String(opts.preferUsuarioId).trim() : ''
  if (prefer) return prefer

  const empresaId = opts?.empresaId != null ? String(opts.empresaId).trim() : ''
  if (empresaId) {
    const { data: log } = await supabase
      .from('logs_verificacao')
      .select('admin_id')
      .eq('tipo', 'empresas')
      .eq('perfil_id', empresaId)
      .eq('acao', 'aprovado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (log?.admin_id) return String(log.admin_id)
  }

  const { data: geral } = await supabase
    .from('usuarios')
    .select('id')
    .eq('role', 'admin')
    .eq('admin_level', 1)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (geral?.id) return String(geral.id)

  const { data: qualquer } = await supabase
    .from('usuarios')
    .select('id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return qualquer?.id != null ? String(qualquer.id) : null
}

/**
 * Aviso na aba Relatórios após o ADM liberar o cadastro da empresa para contratar plano.
 * Idempotente por empresa.
 */
export async function enviarAvisoCadastroLiberadoRelatoriosEmpresa(
  supabase: SupabaseClient,
  empresaUsuarioId: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const uid = empresaUsuarioId?.trim()
  if (!uid) return { ok: false, error: 'usuario_vazio' }

  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('id')
    .eq('usuario_id', uid)
    .maybeSingle()

  if (empErr || !emp?.id) {
    return { ok: false, error: empErr?.message ?? 'empresa_nao_encontrada' }
  }

  const { count } = await supabase
    .from('canal_financeiro')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', emp.id)
    .eq('tipo', 'mensagem_adm')
    .contains('comprovante_detalhes', { variant: VARIANT_CADASTRO_LIBERADO_PLANOS })

  if (count && count > 0) return { ok: true, skipped: true }

  const res = await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
    empresaUsuarioId: uid,
    tipo: 'mensagem_adm',
    titulo: TITULO_CADASTRO_LIBERADO_RELATORIOS,
    mensagem: MENSAGEM_CADASTRO_LIBERADO_RELATORIOS,
    comprovanteDetalhes: { variant: VARIANT_CADASTRO_LIBERADO_PLANOS },
  })

  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true }
}

async function enviarMensagemAprovacaoNumBloco(
  supabase: SupabaseClient,
  params: {
    tipo: 'profissional' | 'empresa'
    usuarioId: string
    nomeUsuario: string
    admUsuarioId: string
    ecossistemaId: string
  },
): Promise<{ ok: boolean; error?: string }> {
  const uid = params.usuarioId
  const admId = params.admUsuarioId
  const eco = params.ecossistemaId
  const mensagem = montarMensagemAprovacaoCadastro(params.nomeUsuario)

  let conversa = await buscarConversaAbertaParaAlvo(supabase, uid, eco)
  if (!conversa) {
    const res = await abrirConversaFinanceiroAdm(supabase, {
      admUsuarioId: admId,
      alvoUsuarioId: uid,
      alvoTipo: params.tipo,
      assunto: ASSUNTO_CONVERSA_APROVACAO_CADASTRO,
      ecossistemaId: eco,
    })
    if (!res.ok || !res.conversa?.id) {
      console.error('[canalFinanceiroAprovacao] abrir conversa', res.error)
      return { ok: false, error: res.error ?? 'conversa_falhou' }
    }
    conversa = res.conversa
  } else if (conversa.assunto?.trim() !== ASSUNTO_CONVERSA_APROVACAO_CADASTRO) {
    const { error: assuntoErr } = await supabase
      .from('financeiro_conversas')
      .update({ assunto: ASSUNTO_CONVERSA_APROVACAO_CADASTRO })
      .eq('id', conversa.id)
    if (assuntoErr) {
      console.error('[canalFinanceiroAprovacao] atualizar assunto', assuntoErr.message)
    } else {
      conversa = { ...conversa, assunto: ASSUNTO_CONVERSA_APROVACAO_CADASTRO }
    }
  }

  const { count } = await supabase
    .from('financeiro_mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('conversa_id', conversa.id)
    .ilike('texto', 'Bem-Vindo%')

  if (count && count > 0) {
    if (conversa.status === 'aberta') {
      const enc = await encerrarConversaFinanceiro(supabase, conversa.id, {
        admUsuarioId: conversa.adm_usuario_id || admId,
      })
      if (!enc.ok) {
        console.error('[canalFinanceiroAprovacao] encerrar conversa existente', enc.error)
      }
    }
    return { ok: true }
  }

  const remetenteId = conversa.adm_usuario_id || admId
  const msg = await enviarMensagemConversaFinanceiro(supabase, {
    conversaId: conversa.id,
    remetenteId,
    texto: mensagem,
  })

  if (!msg.ok) {
    console.error('[canalFinanceiroAprovacao] enviar mensagem', msg.error)
    return { ok: false, error: msg.error ?? 'mensagem_falhou' }
  }

  const enc = await encerrarConversaFinanceiro(supabase, conversa.id, { admUsuarioId: remetenteId })
  if (!enc.ok) {
    console.error('[canalFinanceiroAprovacao] encerrar conversa', enc.error)
    return { ok: false, error: enc.error ?? 'encerrar_falhou' }
  }

  return { ok: true }
}

/**
 * Envia mensagem de boas-vindas no Mensageiro ADM (financeiro_conversas),
 * no(s) bloco(s) do profissional/empresa — nunca cai no padrão se o alvo já tem vínculo.
 */
export async function enviarMensagemAprovacaoCanalFinanceiro(
  supabase: SupabaseClient,
  params: {
    tipo: 'profissional' | 'empresa'
    usuarioId: string
    nomeUsuario: string
    admUsuarioId: string
    ecossistemaIds?: string[] | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const uid = params.usuarioId?.trim()
  const admId = params.admUsuarioId?.trim()
  if (!uid || !admId) return { ok: false, error: 'ids_vazios' }

  const ecos = (params.ecossistemaIds ?? [])
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)
  const blocos = ecos.length > 0 ? ecos : await resolverEcossistemaIdsDoAlvo(supabase, params.tipo, uid)
  if (blocos.length === 0) return { ok: false, error: 'Ecossistema não encontrado.' }

  let lastErr: string | undefined
  let anyOk = false
  for (const eco of blocos) {
    const res = await enviarMensagemAprovacaoNumBloco(supabase, {
      tipo: params.tipo,
      usuarioId: uid,
      nomeUsuario: params.nomeUsuario,
      admUsuarioId: admId,
      ecossistemaId: eco,
    })
    if (res.ok) anyOk = true
    else lastErr = res.error
  }
  return anyOk ? { ok: true } : { ok: false, error: lastErr ?? 'conversa_falhou' }
}

/** Bem-Vindo no Mensageiro após o plano da empresa ficar ativo. */
export async function enviarBoasVindasAposPlanoEmpresa(
  supabase: SupabaseClient,
  params: { empresaUsuarioId: string; empresaId?: string | null; admUsuarioId?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const uid = params.empresaUsuarioId?.trim()
  if (!uid) return { ok: false, error: 'usuario_vazio' }

  const { data: emp } = await supabase
    .from('empresas')
    .select('id, nome_usuario, cidade')
    .eq('usuario_id', uid)
    .maybeSingle()

  const empresaId = params.empresaId?.trim() || (emp?.id != null ? String(emp.id) : '')
  const bloco = await resolverEcoCanaisDaEmpresa(supabase, {
    empresaId: empresaId || null,
    usuarioId: uid,
  })
  if (!bloco?.id) {
    console.error(
      '[canalFinanceiroAprovacao] Bem-Vindo: eco não resolvido pela cidade',
      emp?.cidade ?? null,
    )
    return { ok: false, error: 'ecossistema_cidade_nao_encontrado' }
  }

  const admId = await buscarAdmUsuarioParaMensageiroFinanceiro(supabase, {
    empresaId,
    preferUsuarioId: params.admUsuarioId,
  })
  if (!admId) {
    console.error('[canalFinanceiroAprovacao] Bem-Vindo: ADM não encontrado', { empresaId })
    return { ok: false, error: 'adm_nao_encontrado' }
  }

  const nomeUsuario = String(emp?.nome_usuario ?? '').trim().replace(/^@+/, '')
  return enviarMensagemAprovacaoCanalFinanceiro(supabase, {
    tipo: 'empresa',
    usuarioId: uid,
    nomeUsuario,
    admUsuarioId: admId,
    ecossistemaIds: [bloco.id],
  })
}
