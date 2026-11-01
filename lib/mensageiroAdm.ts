import type { SupabaseClient } from '@supabase/supabase-js'
import { marcarCanalComoLido } from '@/lib/canalBadge'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { handleArrobaCanal } from '@/lib/canalFinanceiroAprovacaoCadastro'
import {
  filtrarCanaisDoBloco,
  garantirCanaisDoEcossistema,
} from '@/lib/canaisEcossistema'
import { resolverEcoCanaisDaEmpresa } from '@/lib/ecoCanaisPorCidade'
import { resolverIdBlocoCanaisAdm } from '@/lib/ecossistemaCanaisAdm'
import { formatarDataCurtaAgendamento } from '@/lib/financeiroAvisosAdmHub'
import { nomeNormCanal } from '@/lib/rotulosCanaisAdministracao'

export type ContextoMensageiroAdm = {
  origem: 'emergencia' | 'falar_adm' | 'sistema'
  role: string
  nomeExibicao?: string | null
}

/** Mesmo tom do aviso de plano no Canal Financeiro. */
export function montarMensagemSolicitacaoVerificacaoCadastro(
  nomeUsuario: string | null | undefined,
  enviadoEm: string,
): string {
  const user = handleArrobaCanal(nomeUsuario)
  const dataCurta = formatarDataCurtaAgendamento(enviadoEm)
  return `Usuário ${user} solicitou verificação de cadastro (novo cliente) no dia ${dataCurta}.`
}

function canalMensageiroDoBloco(
  canais: { id?: string | null; nome?: string | null }[],
): { id: string } | null {
  const eco = canais.find((c) => nomeNormCanal(c.nome) === 'MENSAGEIRO ECOSSISTEMA')
  const legado = canais.find((c) => nomeNormCanal(c.nome) === 'MENSAGEIRO ADM')
  const hit = eco ?? legado
  return hit?.id != null ? { id: String(hit.id) } : null
}

/**
 * Envia mensagem ao canal Mensageiro ADM (visível só para administradores).
 */
export async function enviarMensagemMensageiroAdm(
  supabase: SupabaseClient,
  remetenteId: string,
  texto: string,
  ctx: ContextoMensageiroAdm
): Promise<{ ok: boolean; error?: string }> {
  const corpo = texto.trim()
  if (!corpo) return { ok: false, error: 'Mensagem vazia.' }

  const { data: canais } = await supabase
    .from('canais')
    .select('id, nome, empresa_id, ecossistema_id')
    .eq('tipo_publico', 'admin')
    .eq('ativo', true)

  const blocoId = await resolverIdBlocoCanaisAdm(supabase, remetenteId)
  const visiveis = filtrarCanaisDoBloco(canais ?? [], blocoId)
  const canal = canalMensageiroDoBloco(visiveis)

  if (!canal?.id) {
    return { ok: false, error: 'Canal Mensageiro ADM não encontrado.' }
  }

  const prefixo =
    ctx.origem === 'emergencia'
      ? '🚨 EMERGÊNCIA'
      : ctx.origem === 'falar_adm'
        ? '💬 Falar com ADM'
        : '🔔 Sistema'

  const quem = [ctx.role, ctx.nomeExibicao].filter(Boolean).join(' · ')
  const textoFinal = quem ? `${prefixo} · ${quem}\n\n${corpo}` : `${prefixo}\n\n${corpo}`

  const { error } = await supabase.from('mensagens_canal').insert({
    canal_id: canal.id,
    remetente_id: remetenteId,
    texto: textoFinal,
    pais: 'geral',
  })

  if (error) return { ok: false, error: error.message }

  await marcarCanalComoLido(supabase, remetenteId, String(canal.id))
  notificarBadgeCanais()

  return { ok: true }
}

/**
 * Aviso no Mensageiro ECOSSISTEMA do bloco da cidade da empresa
 * (ADM geral/financeiro). Não usa o Canal Financeiro.
 */
export async function enviarAvisoVerificacaoCadastroMensageiroEco(
  supabase: SupabaseClient,
  opts: { empresaId: string; usuarioId: string },
): Promise<{ ok: boolean; error?: string }> {
  const empresaId = String(opts.empresaId ?? '').trim()
  const usuarioId = String(opts.usuarioId ?? '').trim()
  if (!empresaId || !usuarioId) return { ok: false, error: 'Dados incompletos.' }

  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('id, usuario_id, nome_usuario, documentos_enviados_em')
    .eq('id', empresaId)
    .maybeSingle()
  if (empErr) return { ok: false, error: empErr.message }
  if (!emp?.id) return { ok: false, error: 'Empresa não encontrada.' }
  if (String(emp.usuario_id) !== usuarioId) {
    return { ok: false, error: 'Empresa não pertence ao usuário.' }
  }
  const enviadoEm = String(emp.documentos_enviados_em ?? '').trim()
  if (!enviadoEm) return { ok: false, error: 'Documentos ainda não enviados.' }

  const bloco = await resolverEcoCanaisDaEmpresa(supabase, { empresaId })
  if (!bloco?.id) return { ok: false, error: 'Ecossistema da empresa não encontrado.' }

  await garantirCanaisDoEcossistema(supabase, bloco.id)

  const { data: canais } = await supabase
    .from('canais')
    .select('id, nome, empresa_id, ecossistema_id')
    .eq('tipo_publico', 'admin')
    .eq('ativo', true)

  const canal = canalMensageiroDoBloco(filtrarCanaisDoBloco(canais ?? [], bloco.id))
  if (!canal?.id) {
    return { ok: false, error: 'Canal Mensageiro ECOSSISTEMA não encontrado.' }
  }

  const texto = montarMensagemSolicitacaoVerificacaoCadastro(
    emp.nome_usuario != null ? String(emp.nome_usuario) : '',
    enviadoEm,
  )

  const { error } = await supabase.from('mensagens_canal').insert({
    canal_id: canal.id,
    remetente_id: usuarioId,
    texto,
    pais: 'geral',
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
