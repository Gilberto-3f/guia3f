import { visualizadoPorEmails } from '@/lib/feed-autor'

/**
 * Ordena stories do mesmo autor do mais antigo ao mais novo.
 * @template {{ created_at?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function ordenarStoriesPorCreatedAsc(rows) {
  return [...(rows ?? [])].sort(
    (a, b) =>
      new Date(String(a?.created_at ?? 0)).getTime() - new Date(String(b?.created_at ?? 0)).getTime()
  )
}

/**
 * Primeiro story a abrir: mais antigo ainda não visto pelo email; se todos vistos, o mais antigo.
 * @template {{ id: unknown, visualizado_por?: unknown, created_at?: unknown }} T
 * @param {T[]} rowsAsc já ordenado asc
 * @param {string | null | undefined} userEmail
 * @returns {string | null}
 */
export function escolherIdStoryInicialPorEmail(rowsAsc, userEmail) {
  if (!rowsAsc?.length) return null
  const email = userEmail != null && String(userEmail).trim() !== '' ? String(userEmail).trim() : null
  if (!email) return String(rowsAsc[0].id)
  for (const r of rowsAsc) {
    const emails = visualizadoPorEmails(r.visualizado_por)
    if (!emails.includes(email)) return String(r.id)
  }
  return String(rowsAsc[0].id)
}

/**
 * Para borda do anel (gradiente vs cinza): se existe algum story não visto, tratamos como “não visto”.
 * Se todos vistos, devolve lista com o email para `emailVisualizouStory` / StoryCircle.
 * @template {{ visualizado_por?: unknown }} T
 * @param {T[]} rowsAsc
 * @param {string | null | undefined} userEmail
 * @returns {unknown}
 */
export function visualizadoPorConsolidadoParaAnel(rowsAsc, userEmail) {
  if (!rowsAsc?.length) return null
  const email = userEmail != null && String(userEmail).trim() !== '' ? String(userEmail).trim() : null
  if (!email) return null
  for (const r of rowsAsc) {
    if (!visualizadoPorEmails(r.visualizado_por).includes(email)) return []
  }
  return [email]
}
