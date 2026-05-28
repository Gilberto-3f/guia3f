import type { SupabaseClient } from '@supabase/supabase-js'
import { enviarMensagemMensageiroAdm } from '@/lib/mensageiroAdm'

export const MOTIVOS_DENUNCIA_CANAL = [
  { id: 'spam', label: 'Spam ou propaganda' },
  { id: 'conteudo_improprio', label: 'Conteúdo impróprio' },
  { id: 'assedio', label: 'Assédio ou bullying' },
  { id: 'fraude', label: 'Fraude ou golpe' },
  { id: 'outro', label: 'Outro' },
] as const

export type DenunciaMensagemCanalRow = {
  id: string
  canal_id: string
  mensagem_id: string | null
  tipo: 'mensagem' | 'canal'
  motivo: string
  descricao: string | null
  status: string
  created_at: string
}

export async function enviarDenunciaMensagemCanal(
  supabase: SupabaseClient,
  opts: {
    denuncianteId: string
    canalId: string
    canalNome: string
    mensagemId?: string | null
    textoMensagem?: string | null
    motivo: string
    descricao?: string
    tipo: 'mensagem' | 'canal'
  },
): Promise<{ ok: boolean; error?: string }> {
  const motivoLabel = MOTIVOS_DENUNCIA_CANAL.find((m) => m.id === opts.motivo)?.label ?? opts.motivo
  const descricao = (opts.descricao ?? '').trim()

  const { error } = await supabase.from('denuncias_mensagem_canal').insert({
    canal_id: opts.canalId,
    mensagem_id: opts.tipo === 'mensagem' ? opts.mensagemId : null,
    denunciante_id: opts.denuncianteId,
    tipo: opts.tipo,
    motivo: motivoLabel,
    descricao: descricao || null,
    status: 'pendente',
  })

  if (error) return { ok: false, error: error.message }

  const trecho =
    opts.tipo === 'mensagem' && opts.textoMensagem
      ? `\nMensagem: «${opts.textoMensagem.slice(0, 280)}${opts.textoMensagem.length > 280 ? '…' : ''}»`
      : ''

  const corpoAdm = [
    `Denúncia no canal «${opts.canalNome}»`,
    `Tipo: ${opts.tipo === 'mensagem' ? 'Mensagem' : 'Canal inteiro'}`,
    `Motivo: ${motivoLabel}`,
    descricao ? `Detalhes: ${descricao}` : null,
    opts.mensagemId ? `ID mensagem: ${opts.mensagemId}` : null,
    trecho,
  ]
    .filter(Boolean)
    .join('\n')

  await enviarMensagemMensageiroAdm(supabase, opts.denuncianteId, corpoAdm, {
    origem: 'sistema',
    role: 'denúncia canal',
  })

  return { ok: true }
}

export async function listarDenunciasCanalDoUsuario(
  supabase: SupabaseClient,
  usuarioId: string,
  canalId: string,
): Promise<DenunciaMensagemCanalRow[]> {
  const { data, error } = await supabase
    .from('denuncias_mensagem_canal')
    .select('id, canal_id, mensagem_id, tipo, motivo, descricao, status, created_at')
    .eq('denunciante_id', usuarioId)
    .eq('canal_id', canalId)
    .order('created_at', { ascending: false })
    .limit(80)

  if (error) {
    console.error('listarDenunciasCanalDoUsuario:', error)
    return []
  }

  return (data ?? []).map((r) => ({
    id: String(r.id),
    canal_id: String(r.canal_id),
    mensagem_id: r.mensagem_id != null ? String(r.mensagem_id) : null,
    tipo: r.tipo === 'canal' ? 'canal' : 'mensagem',
    motivo: String(r.motivo ?? ''),
    descricao: r.descricao != null ? String(r.descricao) : null,
    status: String(r.status ?? 'pendente'),
    created_at: String(r.created_at ?? ''),
  }))
}
