/** Erros transitórios do Postgres/PostgREST (timeout, conexão). */
export function isSupabaseTransientError(err: unknown): boolean {
  if (err == null) return false
  const msg = String(
    typeof err === 'object' && err !== null && 'message' in err
      ? (err as { message?: string }).message
      : err,
  ).toLowerCase()
  const code = String(
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: string }).code
      : '',
  ).toLowerCase()
  return (
    code === '57014' ||
    code === '08006' ||
    code === '57p01' ||
    /57014|canceling statement|statement timeout|connection.*(lost|reset|closed)|08006|timeout|timed out|fetch failed|network/i.test(
      msg,
    )
  )
}

/** Executa `fn` e, se for erro transitório, espera e tenta 1 vez. */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  opts?: { delayMs?: number; isError?: (result: T) => boolean },
): Promise<T> {
  const delayMs = opts?.delayMs ?? 400
  const first = await fn()
  if (!opts?.isError?.(first)) return first
  await new Promise((r) => setTimeout(r, delayMs))
  return fn()
}
