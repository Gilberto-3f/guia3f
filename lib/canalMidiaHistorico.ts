import type { SupabaseClient } from '@supabase/supabase-js'
import { aplicarFiltroPaisMensagensCanal, type ModoFiltroPaisCanal } from '@/lib/canalAbasPaisColetivo'
import { ehAnexoAudioCanal, ehAnexoImagemCanal } from '@/lib/canalAnexoUrl'

export type MidiaCanalRow = {
  id: string
  anexo_url: string
  anexo_tipo: string | null
  created_at: string
}

export async function listarMidiaCanal(
  supabase: SupabaseClient,
  canalId: string,
  opts?: { paisTab?: string; limit?: number; modoFiltroPais?: ModoFiltroPaisCanal },
): Promise<MidiaCanalRow[]> {
  const limit = opts?.limit ?? 60
  let query = supabase
    .from('mensagens_canal')
    .select('id, anexo_url, anexo_tipo, created_at')
    .eq('canal_id', canalId)
    .not('anexo_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  query = aplicarFiltroPaisMensagensCanal(
    query,
    opts?.paisTab,
    opts?.modoFiltroPais ?? 'mensageiro_aba',
  )

  const { data, error } = await query
  if (error) {
    console.error('listarMidiaCanal:', error)
    return []
  }

  return (data ?? [])
    .map((r) => ({
      id: String(r.id),
      anexo_url: String(r.anexo_url ?? ''),
      anexo_tipo: r.anexo_tipo != null ? String(r.anexo_tipo) : null,
      created_at: String(r.created_at ?? ''),
    }))
    .filter((r) => ehAnexoImagemCanal(r.anexo_url, r.anexo_tipo) || ehAnexoAudioCanal(r.anexo_url, r.anexo_tipo))
}
