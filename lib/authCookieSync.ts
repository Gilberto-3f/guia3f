/**
 * Alinha cookies HttpOnly (middleware / SSR) com a sessão do cliente Supabase (localStorage).
 */
export async function syncSessionCookiesToServer(session: {
  access_token: string
  refresh_token: string
}): Promise<boolean> {
  const res = await fetch('/api/auth/sync-cookies', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  })
  return res.ok
}

/** Remove cookies de sessão no servidor (após signOut no cliente). */
export async function clearSessionCookiesOnServer(): Promise<boolean> {
  const res = await fetch('/api/auth/sync-cookies', {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  return res.ok
}
