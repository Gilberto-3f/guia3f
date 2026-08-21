import type { SupabaseClient } from '@supabase/supabase-js'

const notaCache = new Map<string, { at: number; nota: number | null }>()
const NOTA_TTL_MS = 5 * 60 * 1000

/** Média arredondada (1 casa) das avaliações do alvo; null se não houver. Cache 5 min (polls da corrida). */
export async function mediaNotaAlvo(
  supabase: SupabaseClient,
  alvoTipo: 'profissional' | 'turista',
  alvoIds: string[],
): Promise<number | null> {
  const ids = [...new Set(alvoIds.map(String).filter(Boolean))]
  if (ids.length === 0) return null
  const cacheKey = `${alvoTipo}:${[...ids].sort().join(',')}`
  const hit = notaCache.get(cacheKey)
  if (hit && Date.now() - hit.at < NOTA_TTL_MS) return hit.nota

  const { data } = await supabase
    .from('avaliacoes')
    .select('nota')
    .eq('alvo_tipo', alvoTipo)
    .in('alvo_id', ids)
  const notas = (data ?? [])
    .map((r) => Number(r.nota))
    .filter((n) => Number.isFinite(n) && n > 0)
  const nota =
    notas.length === 0 ? null : Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10
  notaCache.set(cacheKey, { at: Date.now(), nota })
  return nota
}

export function formatarNotaExibicao(media: number | null | undefined, fallback = 5): string {
  const n = media != null && media > 0 ? media : fallback
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
