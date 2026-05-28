import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET_MENSAGENS = 'mensagens'

const EXT_IMAGEM = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i

/**
 * Extrai o path interno do bucket `mensagens` a partir da URL pública/assinada.
 */
export function extrairPathBucketMensagens(anexoUrl: string): string | null {
  if (!anexoUrl) return null
  try {
    const u = new URL(anexoUrl)
    const marker = `/storage/v1/object/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    const rest = u.pathname.slice(idx + marker.length)
    const parts = rest.split('/').filter(Boolean)
    if (parts.length < 3 || (parts[0] !== 'public' && parts[0] !== 'sign')) return null
    if (parts[1] !== BUCKET_MENSAGENS) return null
    return decodeURIComponent(parts.slice(2).join('/'))
  } catch {
    return null
  }
}

/** URL pública síncrona (sem round-trip async) quando o path do bucket é conhecido. */
export function urlPublicaAnexoMensagemCanal(
  supabase: SupabaseClient,
  anexoUrl: string,
): string {
  if (!anexoUrl) return anexoUrl
  const path = extrairPathBucketMensagens(anexoUrl)
  if (!path) return anexoUrl
  const { data } = supabase.storage.from(BUCKET_MENSAGENS).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Resolve URL exibível do anexo (pública; assinada se `forceSigned`).
 */
export async function resolverUrlAnexoMensagemCanal(
  supabase: SupabaseClient,
  anexoUrl: string,
  opts?: { forceSigned?: boolean },
): Promise<string> {
  if (!anexoUrl) return anexoUrl

  const path = extrairPathBucketMensagens(anexoUrl)
  if (!path) return anexoUrl

  if (opts?.forceSigned) {
    const { data, error } = await supabase.storage.from(BUCKET_MENSAGENS).createSignedUrl(path, 60 * 60)
    if (!error && data?.signedUrl) return data.signedUrl
  }

  return urlPublicaAnexoMensagemCanal(supabase, anexoUrl)
}

/**
 * URL redimensionada no edge do Supabase (menos bytes; vale para anexos antigos e novos).
 */
export function urlPreviewImagemAnexoMensagemCanal(
  supabase: SupabaseClient,
  anexoUrl: string,
  opts?: { width?: number; quality?: number },
): string {
  const width = opts?.width ?? 560
  const quality = opts?.quality ?? 75
  const path = extrairPathBucketMensagens(anexoUrl)
  if (!path) return urlPublicaAnexoMensagemCanal(supabase, anexoUrl)

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!baseUrl) return urlPublicaAnexoMensagemCanal(supabase, anexoUrl)

  const encoded = path.split('/').map((seg) => encodeURIComponent(seg)).join('/')
  return `${baseUrl}/storage/v1/render/image/public/${BUCKET_MENSAGENS}/${encoded}?width=${width}&quality=${quality}&resize=contain`
}

/** Pré-carrega as últimas imagens do chat no navegador (útil ao abrir o canal). */
export function prefetchImagensAnexosCanal(
  supabase: SupabaseClient,
  mensagens: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
  limit = 8,
): void {
  if (typeof window === 'undefined' || limit <= 0) return
  let carregadas = 0
  for (let i = mensagens.length - 1; i >= 0 && carregadas < limit; i--) {
    const m = mensagens[i]
    if (!m.anexo_url || !ehAnexoImagemCanal(m.anexo_url, m.anexo_tipo)) continue
    const url = urlPreviewImagemAnexoMensagemCanal(supabase, m.anexo_url)
    const img = new window.Image()
    img.decoding = 'async'
    img.src = url
    carregadas++
  }
}

/** Anexo é imagem (`anexo_tipo` ou extensão na URL). */
export function ehAnexoImagemCanal(anexoUrl: string | null | undefined, anexoTipo: string | null | undefined): boolean {
  if (!anexoUrl) return false
  const tipo = (anexoTipo ?? '').trim().toLowerCase()
  if (tipo === 'imagem' || tipo.startsWith('image/')) return true
  if (tipo === 'documento') return false
  return EXT_IMAGEM.test(anexoUrl)
}
