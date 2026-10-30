import type { SupabaseClient } from '@supabase/supabase-js'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { resolverEcoCanaisDaEmpresa, resolverEcoCanaisDoProfissional } from '@/lib/ecoCanaisPorCidade'
import { buscarEcoIdsDaEmpresa } from '@/lib/ecossistemaFiltro'
import { listarEcossistemasDb } from '@/lib/ecossistemas'
import {
  ASSUNTO_CONVERSA_APROVACAO_CADASTRO,
  abrirConversaFinanceiroAdm,
  buscarConversaAbertaParaAlvo,
  encerrarConversaFinanceiro,
  enviarMensagemConversaFinanceiro,
} from '@/lib/financeiroConversas'

export const TITULO_CADASTRO_LIBERADO_RELATORIOS = 'PARÁBENS'

export const MENSAGEM_CADASTRO_LIBERADO_RELATORIOS =
  'Seu cadastro foi liberado, escolha um plano (na terceira aba) para utilizar todos os benefícios do aplicativo.'

export const VARIANT_CADASTRO_LIBERADO_PLANOS = 'cadastro_liberado_planos'

export function handleArrobaCanal(nomeUsuario: string | null | undefined): string {
  const handle = String(nomeUsuario ?? '').trim().replace(/^@+/, '')
  return handle ? `@${handle}` : '@usuario'
}

export function mensagemCadastroLiberadoRelatoriosExibicao(
  titulo: string,
  mensagem: string | null | undefined,
): string | null {
  if (String(titulo ?? '').trim().toUpperCase() === TITULO_CADASTRO_LIBERADO_RELATORIOS) {
    return MENSAGEM_CADASTRO_LIBERADO_RELATORIOS
  }
  return mensagem != null && String(mensagem).trim() !== '' ? String(mensagem) : null
}

export function montarMensagemAprovacaoCadastro(nomeUsuario: string): string {
  const user = handleArrobaCanal(nomeUsuario)
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

function variantDeJson(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ''
  return String((raw as { variant?: unknown }).variant ?? '').trim()
}

function rowEhAvisoCadastroLiberado(row: {
  titulo?: unknown
  comprovante_detalhes?: unknown
  metadata?: unknown
}): boolean {
  if (variantDeJson(row.comprovante_detalhes) === VARIANT_CADASTRO_LIBERADO_PLANOS) return true
  if (variantDeJson(row.metadata) === VARIANT_CADASTRO_LIBERADO_PLANOS) return true
  return String(row.titulo ?? '').trim().toUpperCase() === TITULO_CADASTRO_LIBERADO_RELATORIOS
}

async function jaTemAvisoCadastroLiberado(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('canal_financeiro')
    .select('id, titulo, comprovante_detalhes, metadata')
    .eq('empresa_id', empresaId)
    .eq('tipo', 'mensagem_adm')
    .limit(50)
  if (error) {
    console.warn('[canalFinanceiroAprovacao] checar PARÁBÉNS:', error.message)
    return false
  }
  return (data ?? []).some((row) => rowEhAvisoCadastroLiberado(row))
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

  if (await jaTemAvisoCadastroLiberado(supabase, String(emp.id))) {
    return { ok: true, skipped: true }
  }

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

/** Até 3 tentativas — a aprovação não pode “passar quieta” sem o card em Relatórios. */
export async function garantirAvisoCadastroLiberadoRelatoriosEmpresa(
  supabase: SupabaseClient,
  empresaUsuarioId: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  let lastErr: string | undefined
  for (let i = 0; i < 3; i++) {
    const res = await enviarAvisoCadastroLiberadoRelatoriosEmpresa(supabase, empresaUsuarioId)
    if (res.ok) return res
    lastErr = res.error
  }
  return { ok: false, error: lastErr ?? 'aviso_relatorios_falhou' }
}

async function jaTemBemVindoNoBloco(
  supabase: SupabaseClient,
  usuarioId: string,
  eco: string,
): Promise<boolean> {
  const { data: convs, error } = await supabase
    .from('financeiro_conversas')
    .select('id')
    .eq('alvo_usuario_id', usuarioId)
    .eq('ecossistema_id', eco)
  if (error) {
    console.warn('[canalFinanceiroAprovacao] checar Bem-Vindo:', error.message)
    return false
  }
  const ids = (convs ?? []).map((c) => String((c as { id?: unknown }).id ?? '')).filter(Boolean)
  if (ids.length === 0) return false

  const { data: msgs, error: msgErr } = await supabase
    .from('financeiro_mensagens')
    .select('id')
    .in('conversa_id', ids)
    .ilike('texto', 'Bem-Vindo%')
    .limit(1)
  if (msgErr) {
    console.warn('[canalFinanceiroAprovacao] checar Bem-Vindo msgs:', msgErr.message)
    return false
  }
  return (msgs ?? []).length > 0
}

/** Cidade do cadastro; se falhar, vínculo N:N — nunca o bloco padrão (Tríplice). */
async function resolverEcoIdEmpresaParaBemVindo(
  supabase: SupabaseClient,
  opts: { empresaId?: string | null; usuarioId?: string | null },
): Promise<string | null> {
  const bloco = await resolverEcoCanaisDaEmpresa(supabase, opts)
  if (bloco?.id) return bloco.id

  const empresaId = opts.empresaId != null ? String(opts.empresaId).trim() : ''
  if (!empresaId) return null

  const vinculoIds = await buscarEcoIdsDaEmpresa(supabase, empresaId)
  if (!vinculoIds || vinculoIds.length === 0) return null

  const todos = await listarEcossistemasDb(supabase)
  const candidatos = todos.filter((b) => vinculoIds.includes(b.id) && !b.padrao)
  if (candidatos.length === 0) return null

  const hit =
    candidatos.find((b) => b.tipo === 'regiao') ??
    candidatos.find((b) => b.tipo === 'cidade') ??
    candidatos[0]
  return hit?.id ?? null
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
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const uid = params.usuarioId
  const admId = params.admUsuarioId
  const eco = params.ecossistemaId
  const mensagem = montarMensagemAprovacaoCadastro(params.nomeUsuario)

  if (await jaTemBemVindoNoBloco(supabase, uid, eco)) {
    const aberta = await buscarConversaAbertaParaAlvo(supabase, uid, eco)
    if (aberta?.status === 'aberta') {
      const { count } = await supabase
        .from('financeiro_mensagens')
        .select('id', { count: 'exact', head: true })
        .eq('conversa_id', aberta.id)
        .ilike('texto', 'Bem-Vindo%')
      const ehBoasVindas =
        (count ?? 0) > 0 || aberta.assunto?.trim() === ASSUNTO_CONVERSA_APROVACAO_CADASTRO
      if (ehBoasVindas) {
        const enc = await encerrarConversaFinanceiro(supabase, aberta.id, {
          admUsuarioId: aberta.adm_usuario_id || admId,
        })
        if (!enc.ok) {
          console.error('[canalFinanceiroAprovacao] encerrar conversa existente', enc.error)
        }
      }
    }
    return { ok: true, skipped: true }
  }

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
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
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
  let allSkipped = true
  for (const eco of blocos) {
    const res = await enviarMensagemAprovacaoNumBloco(supabase, {
      tipo: params.tipo,
      usuarioId: uid,
      nomeUsuario: params.nomeUsuario,
      admUsuarioId: admId,
      ecossistemaId: eco,
    })
    if (res.ok) {
      anyOk = true
      if (!res.skipped) allSkipped = false
    } else {
      lastErr = res.error
      allSkipped = false
    }
  }
  if (!anyOk) return { ok: false, error: lastErr ?? 'conversa_falhou' }
  return allSkipped ? { ok: true, skipped: true } : { ok: true }
}

/** Bem-Vindo no Mensageiro após o plano da empresa ficar ativo. */
export async function enviarBoasVindasAposPlanoEmpresa(
  supabase: SupabaseClient,
  params: { empresaUsuarioId: string; empresaId?: string | null; admUsuarioId?: string | null },
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const uid = params.empresaUsuarioId?.trim()
  if (!uid) return { ok: false, error: 'usuario_vazio' }

  const { data: emp } = await supabase
    .from('empresas')
    .select('id, nome_usuario, cidade')
    .eq('usuario_id', uid)
    .maybeSingle()

  const empresaId = params.empresaId?.trim() || (emp?.id != null ? String(emp.id) : '')
  const ecoId = await resolverEcoIdEmpresaParaBemVindo(supabase, {
    empresaId: empresaId || null,
    usuarioId: uid,
  })
  if (!ecoId) {
    console.error(
      '[canalFinanceiroAprovacao] Bem-Vindo: eco não resolvido (cidade nem vínculo)',
      emp?.cidade ?? null,
      { empresaId },
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
    ecossistemaIds: [ecoId],
  })
}

/** Até 3 tentativas — o plano ativo não pode passar sem Bem-Vindo no Mensageiro. */
export async function garantirBoasVindasAposPlanoEmpresa(
  supabase: SupabaseClient,
  params: { empresaUsuarioId: string; empresaId?: string | null; admUsuarioId?: string | null },
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  let lastErr: string | undefined
  for (let i = 0; i < 3; i++) {
    const res = await enviarBoasVindasAposPlanoEmpresa(supabase, params)
    if (res.ok) return res
    lastErr = res.error
  }
  return { ok: false, error: lastErr ?? 'bem_vindo_falhou' }
}
