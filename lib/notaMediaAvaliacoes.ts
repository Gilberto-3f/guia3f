import type { SupabaseClient } from '@supabase/supabase-js'

/** Média arredondada (1 casa) das avaliações do alvo; null se não houver. */
export async function mediaNotaAlvo(
  supabase: SupabaseClient,
  alvoTipo: 'profissional' | 'turista',
  alvoIds: string[],
): Promise<number | null> {
  const ids = [...new Set(alvoIds.map(String).filter(Boolean))]
  if (ids.length === 0) return null
  const { data } = await supabase
    .from('avaliacoes')
    .select('nota')
    .eq('alvo_tipo', alvoTipo)
    .in('alvo_id', ids)
  const notas = (data ?? [])
    .map((r) => Number(r.nota))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (notas.length === 0) return null
  const media = notas.reduce((s, n) => s + n, 0) / notas.length
  return Math.round(media * 10) / 10
}

export function formatarNotaExibicao(media: number | null | undefined, fallback = 5): string {
  const n = media != null && media > 0 ? media : fallback
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
