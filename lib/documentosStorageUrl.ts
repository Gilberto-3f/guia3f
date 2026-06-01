import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'documentos'
const TTL_SIGNED_MS = 50 * 60 * 1000

const cacheSignedUrl = new Map<string, { url: string; expira: number }>()

/** Extrai o path interno do bucket `documentos` a partir da URL pública/assinada. */
export function extrairPathBucketDocumentos(anexoUrl: string): string | null {
  if (!anexoUrl) return null
  try {
    const u = new URL(anexoUrl)
    const marker = `/storage/v1/object/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    const rest = u.pathname.slice(idx + marker.length)
    const parts = rest.split('/').filter(Boolean)
    if (parts.length < 3 || (parts[0] !== 'public' && parts[0] !== 'sign')) return null
    if (parts[1] !== BUCKET) return null
    return decodeURIComponent(parts.slice(2).join('/'))
  } catch {
    return null
  }
}

/**
 * Resolve URL de documento para exibição no admin.
 * Bucket `documentos` costuma ser privado — usa URL assinada quando possível.
 */
export async function resolverUrlDocumentoStorage(
  supabase: SupabaseClient,
  anexoUrl: string,
): Promise<string> {
  if (!anexoUrl) return anexoUrl

  const path = extrairPathBucketDocumentos(anexoUrl)
  if (!path) return anexoUrl

  const agora = Date.now()
  const emCache = cacheSignedUrl.get(path)
  if (emCache && emCache.expira > agora) return emCache.url

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (!error && data?.signedUrl) {
    cacheSignedUrl.set(path, { url: data.signedUrl, expira: agora + TTL_SIGNED_MS })
    return data.signedUrl
  }

  return anexoUrl
}

/** Resolve várias URLs em paralelo (miniaturas / modal de verificação). */
export async function resolverUrlsDocumentosStorage(
  supabase: SupabaseClient,
  urls: string[],
): Promise<Map<string, string>> {
  const unicas = [...new Set(urls.map((u) => u.trim()).filter(Boolean))]
  const map = new Map<string, string>()
  await Promise.all(
    unicas.map(async (original) => {
      const resolvida = await resolverUrlDocumentoStorage(supabase, original)
      map.set(original, resolvida)
    }),
  )
  return map
}

/**
 * Dashboard ADM: URLs assinadas via API (service role), contorna RLS do bucket privado.
 */
export async function resolverUrlsDocumentosStorageAdmin(urls: string[]): Promise<Map<string, string>> {
  const unicas = [...new Set(urls.map((u) => u.trim()).filter(Boolean))]
  const map = new Map<string, string>()
  if (!unicas.length) return map

  const agora = Date.now()
  const pendentes: string[] = []
  for (const original of unicas) {
    const path = extrairPathBucketDocumentos(original)
    if (path) {
      const emCache = cacheSignedUrl.get(path)
      if (emCache && emCache.expira > agora) {
        map.set(original, emCache.url)
        continue
      }
    }
    pendentes.push(original)
  }

  if (!pendentes.length) return map

  try {
    const res = await fetch('/api/admin/documentos-urls', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: pendentes }),
    })
    const json = (await res.json().catch(() => ({}))) as { urls?: Record<string, string>; error?: string }
    if (!res.ok) {
      for (const u of pendentes) map.set(u, u)
      return map
    }
    for (const original of pendentes) {
      const resolvida = json.urls?.[original] ?? original
      map.set(original, resolvida)
      const path = extrairPathBucketDocumentos(original)
      if (path && resolvida !== original) {
        cacheSignedUrl.set(path, { url: resolvida, expira: agora + TTL_SIGNED_MS })
      }
    }
  } catch {
    for (const u of pendentes) map.set(u, u)
  }
  return map
}
