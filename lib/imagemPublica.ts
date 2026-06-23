/** Helpers para exibir mídia remota sem quebrar next/image. */

/** Converte URL autenticada do Supabase Storage em URL pública quando possível. */
export function normalizarUrlMidiaSupabase(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  return s.replace('/storage/v1/object/authenticated/', '/storage/v1/object/public/')
}

export function urlMidiaValida(raw: string | null | undefined): boolean {
  const s = normalizarUrlMidiaSupabase(raw)
  if (!s) return false
  if (s.startsWith('/') || s.startsWith('data:')) return true
  return /^https?:\/\//i.test(s)
}

/** URL pública do Supabase Storage (compatível com remotePatterns do Next). */
export function urlSupabaseStoragePublica(raw: string): boolean {
  return raw.includes('/storage/v1/object/public/')
}

export function podeUsarNextImage(src: string): boolean {
  // URLs remotas (Supabase, etc.) usam <img> nativo — evita proxy Vercel (_next/image) e erro 402.
  if (/^https?:\/\//i.test(src)) return false
  if (src.startsWith('/') || src.startsWith('data:')) return true
  return false
}
