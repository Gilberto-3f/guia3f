import type { SupabaseClient } from '@supabase/supabase-js'
import { aplicarFiltroPaisMensagensCanal, type ModoFiltroPaisCanal } from '@/lib/canalAbasPaisColetivo'

export type MensagemCanalBuscaRow = {
  id: string
  texto: string | null
  anexo_url: string | null
  anexo_tipo: string | null
  created_at: string
  remetente_id: string | null
}

export async function buscarMensagensCanalPorTexto(
  supabase: SupabaseClient,
  canalId: string,
  termo: string,
  opts?: { paisTab?: string; limit?: number; modoFiltroPais?: ModoFiltroPaisCanal },
): Promise<MensagemCanalBuscaRow[]> {
  const q = termo.trim()
  if (!q || q.length < 2) return []

  const limit = opts?.limit ?? 40
  let query = supabase
    .from('mensagens_canal')
    .select('id, texto, anexo_url, anexo_tipo, created_at, remetente_id')
    .eq('canal_id', canalId)
    .ilike('texto', `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  query = aplicarFiltroPaisMensagensCanal(
    query,
    opts?.paisTab,
    opts?.modoFiltroPais ?? 'mensageiro_aba',
  )

  const { data, error } = await query
  if (error) {
    console.error('buscarMensagensCanalPorTexto:', error)
    return []
  }

  return (data ?? []).map((r) => ({
    id: String(r.id),
    texto: r.texto != null ? String(r.texto) : null,
    anexo_url: r.anexo_url != null ? String(r.anexo_url) : null,
    anexo_tipo: r.anexo_tipo != null ? String(r.anexo_tipo) : null,
    created_at: String(r.created_at ?? ''),
    remetente_id: r.remetente_id != null ? String(r.remetente_id) : null,
  }))
}
