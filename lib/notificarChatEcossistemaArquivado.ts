import type { SupabaseClient } from '@supabase/supabase-js'
import type { EcossistemaConversaRow } from '@/lib/ecossistemaConversas'

export async function notificarChatEcossistemaArquivado(
  supabase: SupabaseClient,
  conversa: EcossistemaConversaRow,
  opts?: { resumo?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const resumo = opts?.resumo?.trim()
  const urgenteTxt = conversa.urgente ? ' (solicitação emergencial)' : ''
  const titulo = conversa.urgente ? 'Chat ADM — atendimento emergencial encerrado' : 'Chat ADM encerrado'
  const descricao = resumo
    ? `Diálogo com a administração finalizado${urgenteTxt}. ${resumo}`
    : `Seu diálogo com a administração foi finalizado${urgenteTxt}. O histórico permanece disponível nesta aba.`

  const agora = new Date().toISOString()
  const { error } = await supabase.from('historico_decisoes').insert({
    usuario_id: conversa.membro_usuario_id,
    tipo: 'chat_ecossistema',
    titulo,
    descricao,
    status: 'cumprido',
    data_conclusao: agora,
    ecossistema_conversa_id: conversa.id,
    visualizado: false,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
