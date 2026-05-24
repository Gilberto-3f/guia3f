import type { SupabaseClient } from '@supabase/supabase-js'

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
    .select('id, nome')
    .eq('tipo_publico', 'admin')
    .eq('ativo', true)

  const canal = (canais ?? []).find((c) => {
    const n = String(c.nome ?? '').trim().toUpperCase()
    return n === 'MENSAGEIRO ADM'
  })

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
  return { ok: true }
}
