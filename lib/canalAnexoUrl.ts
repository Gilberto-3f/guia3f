import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET_MENSAGENS = 'mensagens'

const EXT_IMAGEM = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i

/** Cache em memória de URLs assinadas (evita round-trip repetido no chat). */
const cacheSignedUrl = new Map<string, { url: string; expira: number }>()
const TTL_SIGNED_MS = 50 * 60 * 1000

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
    const agora = Date.now()
    const emCache = cacheSignedUrl.get(path)
    if (emCache && emCache.expira > agora) return emCache.url

    const { data, error } = await supabase.storage.from(BUCKET_MENSAGENS).createSignedUrl(path, 60 * 60)
    if (!error && data?.signedUrl) {
      cacheSignedUrl.set(path, { url: data.signedUrl, expira: agora + TTL_SIGNED_MS })
      return data.signedUrl
    }
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

/** URL preferida na miniatura do chat (pública = sem cold start do endpoint /render/image). */
export function urlExibicaoChatImagemAnexoCanal(
  supabase: SupabaseClient,
  anexoUrl: string,
): string {
  return urlPublicaAnexoMensagemCanal(supabase, anexoUrl)
}

const aquecimentoInflight = new Map<string, Promise<void>>()

/**
 * Pré-resolve URLs assinadas em lote e aquece o cache HTTP do navegador.
 * Chamar assim que as mensagens chegarem (antes ou junto do primeiro render das `<img>`).
 */
export async function aquecerCacheImagensMensagensCanal(
  supabase: SupabaseClient,
  mensagens: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
  opts?: { canalId?: string; limit?: number },
): Promise<void> {
  if (typeof window === 'undefined') return
  const limit = opts?.limit ?? 16
  const canalKey = opts?.canalId ?? '_'

  const existente = aquecimentoInflight.get(canalKey)
  if (existente) return existente

  const tarefa = (async () => {
    const anexos: string[] = []
    for (let i = mensagens.length - 1; i >= 0 && anexos.length < limit; i--) {
      const m = mensagens[i]
      if (!m.anexo_url || !ehAnexoImagemCanal(m.anexo_url, m.anexo_tipo)) continue
      anexos.push(m.anexo_url)
    }
    if (anexos.length === 0) return

    prefetchImagensAnexosCanal(supabase, mensagens, limit)

    void Promise.all(
      anexos.map((anexoUrl) =>
        resolverUrlAnexoMensagemCanal(supabase, anexoUrl, { forceSigned: true }).catch(() => null),
      ),
    )
  })()

  aquecimentoInflight.set(canalKey, tarefa)
  try {
    await tarefa
  } finally {
    aquecimentoInflight.delete(canalKey)
  }
}

/** Pré-carrega imagens no navegador (URL pública + preload nas primeiras). */
export function prefetchImagensAnexosCanal(
  supabase: SupabaseClient,
  mensagens: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
  limit = 16,
): void {
  if (typeof window === 'undefined' || limit <= 0) return
  let carregadas = 0
  for (let i = mensagens.length - 1; i >= 0 && carregadas < limit; i--) {
    const m = mensagens[i]
    if (!m.anexo_url || !ehAnexoImagemCanal(m.anexo_url, m.anexo_tipo)) continue
    const url = urlExibicaoChatImagemAnexoCanal(supabase, m.anexo_url)
    if (carregadas < 4) {
      try {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = url
        document.head.appendChild(link)
        window.setTimeout(() => link.remove(), 60_000)
      } catch {
        /* ignore */
      }
    }
    const img = new window.Image()
    img.decoding = 'async'
    img.fetchPriority = carregadas < 6 ? 'high' : 'low'
    img.src = url
    carregadas++
  }
}

/** Limpa fila de aquecimento (ex.: logout). */
export function limparAquecimentoImagensCanais(): void {
  aquecimentoInflight.clear()
}

/** Anexo é imagem (`anexo_tipo` ou extensão na URL). */
export function ehAnexoImagemCanal(anexoUrl: string | null | undefined, anexoTipo: string | null | undefined): boolean {
  if (!anexoUrl) return false
  const tipo = (anexoTipo ?? '').trim().toLowerCase()
  if (tipo === 'imagem' || tipo.startsWith('image/')) return true
  if (tipo === 'documento' || tipo === 'audio' || tipo.startsWith('audio/')) return false
  return EXT_IMAGEM.test(anexoUrl)
}

/** Anexo é áudio (`anexo_tipo` ou extensão na URL). */
export function ehAnexoAudioCanal(anexoUrl: string | null | undefined, anexoTipo: string | null | undefined): boolean {
  if (!anexoUrl) return false
  const tipo = (anexoTipo ?? '').trim().toLowerCase()
  if (tipo === 'audio' || tipo.startsWith('audio/')) return true
  return /\.(webm|ogg|opus|mp3|m4a|aac|wav)(\?.*)?$/i.test(anexoUrl)
}
