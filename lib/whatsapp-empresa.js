/**
 * Digits-only for wa.me (sem +).
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function digitsWhatsapp(raw) {
  if (!raw) return ''
  const d = String(raw).replace(/\D/g, '')
  return d
}

/**
 * @param {string | null | undefined} raw
 */
export function whatsappWaUrl(raw) {
  const d = digitsWhatsapp(raw)
  if (d) return d
  const fallback = process.env.NEXT_PUBLIC_WHATSAPP_EMPRESAS_DEFAULT
  return fallback ? digitsWhatsapp(fallback) : ''
}
