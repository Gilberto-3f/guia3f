import type { SupabaseClient } from '@supabase/supabase-js'
import { marcarCanalComoLido } from '@/lib/canalBadge'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { filtrarCanaisDoBloco } from '@/lib/canaisEcossistema'
import { resolverIdBlocoCanaisAdm } from '@/lib/ecossistemaCanaisAdm'

export type ContextoMensageiroAdm = {
  origem: 'emergencia' | 'falar_adm' | 'sistema'
  role: string
  nomeExibicao?: string | null
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
  const canal =
    visiveis.find((c) => String(c.nome ?? '').trim().toUpperCase() === 'MENSAGEIRO ECOSSISTEMA') ??
    visiveis.find((c) => String(c.nome ?? '').trim().toUpperCase() === 'MENSAGEIRO ADM')

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
