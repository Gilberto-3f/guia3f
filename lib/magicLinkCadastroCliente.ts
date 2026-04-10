import { sendPostCadastroMagicLink } from '@/lib/sendPostCadastroMagicLink'

/**
 * Garante envio do magic link: tenta primeiro a API (OTP com anon no servidor),
 * depois o fluxo legado no browser.
 */
export async function garantirMagicLinkEnviado(email: string): Promise<boolean> {
  const redirectOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  try {
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        redirectOrigin,
      }),
    })
    const j = (await res.json().catch(() => ({}))) as { magicLinkSent?: boolean }
    if (j.magicLinkSent === true) return true
  } catch {
    /* rede / parsing */
  }

  const { error } = await sendPostCadastroMagicLink(email)
  return !error
}
