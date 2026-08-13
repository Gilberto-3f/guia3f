/**
 * RPC pública (GRANT anon) sem JWT do usuário.
 * Evita 401 em massa quando a sessão está expirada/inválida:
 * PostgREST rejeita Bearer morto mesmo se a função permite anon.
 */
export async function rpcAnon(
  fnName: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !key) {
    return { ok: false, status: 0, error: 'missing_env' }
  }

  try {
    const res = await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(fnName)}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(args),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: text.slice(0, 200) || `http_${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'network',
    }
  }
}
