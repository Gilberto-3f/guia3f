import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET_MENSAGENS = 'mensagens'

const EXT_IMAGEM = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i

const TTL_SIGNED_MS = 50 * 60 * 1000
const TTL_CHAT_MS = 50 * 60 * 1000
const THUMB_CHAT_WIDTH = 280
const THUMB_CHAT_QUALITY = 72
const PROBE_THUMB_MS = 1500

/** Cache em memória de URLs assinadas (evita round-trip repetido no chat). */
const cacheSignedUrl = new Map<string, { url: string; expira: number }>()

/** URL final escolhida para miniatura no chat (após probe ou fallback). */
const cacheUrlChat = new Map<string, { url: string; expira: number }>()

const aquecimentoInflight = new Map<string, Promise<void>>()

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

/** Miniatura leve para o balão do chat (~280px). */
export function urlExibicaoChatImagemAnexoCanal(
  supabase: SupabaseClient,
  anexoUrl: string,
): string {
  return urlPreviewImagemAnexoMensagemCanal(supabase, anexoUrl, {
    width: THUMB_CHAT_WIDTH,
    quality: THUMB_CHAT_QUALITY,
  })
}

/** URL já resolvida em `prepararImagensChatCanal` (se existir). */
export function obterUrlChatImagemEmCache(anexoUrl: string): string | null {
  const path = extrairPathBucketMensagens(anexoUrl)
  if (!path) return null
  const emCache = cacheUrlChat.get(path)
  if (emCache && emCache.expira > Date.now()) return emCache.url
  return null
}

function coletarAnexosImagemRecentes(
  mensagens: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
  limit: number,
): string[] {
  const anexos: string[] = []
  for (let i = mensagens.length - 1; i >= 0 && anexos.length < limit; i--) {
    const m = mensagens[i]
    if (!m.anexo_url || !ehAnexoImagemCanal(m.anexo_url, m.anexo_tipo)) continue
    anexos.push(m.anexo_url)
  }
  return anexos
}

function probeCarregaImagem(url: string, timeoutMs: number): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  return new Promise((resolve) => {
    const img = new window.Image()
    let feito = false
    const encerrar = (ok: boolean) => {
      if (feito) return
      feito = true
      clearTimeout(timer)
      img.onload = null
      img.onerror = null
      resolve(ok)
    }
    const timer = window.setTimeout(() => encerrar(false), timeoutMs)
    img.onload = () => encerrar(true)
    img.onerror = () => encerrar(false)
    img.decoding = 'async'
    img.src = url
  })
}

function prefetchUrlNoNavegador(url: string, prioridade: 'high' | 'low'): void {
  if (typeof window === 'undefined') return
  const img = new window.Image()
  img.decoding = 'async'
  img.fetchPriority = prioridade
  img.src = url
}

/**
 * Resolve URL final da miniatura (thumbnail render ou assinada) e aquece cache HTTP.
 */
export async function resolverUrlChatImagemCanal(
  supabase: SupabaseClient,
  anexoUrl: string,
): Promise<string> {
  const path = extrairPathBucketMensagens(anexoUrl)
  if (!path) return anexoUrl

  const emCache = cacheUrlChat.get(path)
  if (emCache && emCache.expira > Date.now()) return emCache.url

  const thumb = urlExibicaoChatImagemAnexoCanal(supabase, anexoUrl)
  const [thumbOk, signed] = await Promise.all([
    probeCarregaImagem(thumb, PROBE_THUMB_MS),
    resolverUrlAnexoMensagemCanal(supabase, anexoUrl, { forceSigned: true }),
  ])
  const url = thumbOk ? thumb : signed
  const expira = Date.now() + TTL_CHAT_MS
  cacheUrlChat.set(path, { url, expira })
  return url
}

/**
 * Preenche o cache de chat com URLs de miniatura (síncrono, sem rede).
 * Permite mostrar mensagens de imediato com skeleton/img a partir da thumb.
 */
export function primarCacheMiniaturasChatCanal(
  supabase: SupabaseClient,
  mensagens: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
  opts?: { limit?: number },
): void {
  if (typeof window === 'undefined') return
  const limit = opts?.limit ?? 16
  const anexos = coletarAnexosImagemRecentes(mensagens, limit)
  const agora = Date.now()
  const expira = agora + TTL_CHAT_MS
  for (const anexoUrl of anexos) {
    const path = extrairPathBucketMensagens(anexoUrl)
    if (!path) continue
    const emCache = cacheUrlChat.get(path)
    if (emCache && emCache.expira > agora) continue
    const thumb = urlExibicaoChatImagemAnexoCanal(supabase, anexoUrl)
    cacheUrlChat.set(path, { url: thumb, expira })
    prefetchUrlNoNavegador(thumb, 'low')
  }
}

/** Probe + assinada em background; atualiza cache se a thumb não carregar. */
async function refinarCacheImagensChatCanal(
  supabase: SupabaseClient,
  mensagens: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
  opts?: { limit?: number },
): Promise<void> {
  if (typeof window === 'undefined') return
  const limit = opts?.limit ?? 16
  const anexos = coletarAnexosImagemRecentes(mensagens, limit)
  if (anexos.length === 0) return

  await Promise.all(
    anexos.map((anexoUrl) => resolverUrlAnexoMensagemCanal(supabase, anexoUrl, { forceSigned: true }).catch(() => null)),
  )

  let i = 0
  await Promise.all(
    anexos.map(async (anexoUrl) => {
      const path = extrairPathBucketMensagens(anexoUrl)
      if (!path) return
      const thumb = urlExibicaoChatImagemAnexoCanal(supabase, anexoUrl)
      const [thumbOk, signed] = await Promise.all([
        probeCarregaImagem(thumb, PROBE_THUMB_MS),
        resolverUrlAnexoMensagemCanal(supabase, anexoUrl, { forceSigned: true }),
      ])
      const url = thumbOk ? thumb : signed
      cacheUrlChat.set(path, { url, expira: Date.now() + TTL_CHAT_MS })
      prefetchUrlNoNavegador(url, i < 6 ? 'high' : 'low')
      i++
    }),
  )
}

/**
 * Pré-resolve assinadas e refina URLs (probe). Use em background — não bloqueie o chat.
 */
export async function prepararImagensChatCanal(
  supabase: SupabaseClient,
  mensagens: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
  opts?: { canalId?: string; limit?: number },
): Promise<void> {
  primarCacheMiniaturasChatCanal(supabase, mensagens, { limit: opts?.limit })
  await refinarCacheImagensChatCanal(supabase, mensagens, { limit: opts?.limit })
}

/**
 * Aquecimento rápido (síncrono) + refinamento em background com dedupe por canal.
 */
export function aquecerCacheImagensMensagensCanal(
  supabase: SupabaseClient,
  mensagens: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
  opts?: { canalId?: string; limit?: number },
): void {
  if (typeof window === 'undefined') return
  primarCacheMiniaturasChatCanal(supabase, mensagens, { limit: opts?.limit })

  const canalKey = opts?.canalId ?? '_'
  if (aquecimentoInflight.has(canalKey)) return

  const tarefa = refinarCacheImagensChatCanal(supabase, mensagens, { limit: opts?.limit })
  aquecimentoInflight.set(canalKey, tarefa)
  void tarefa.finally(() => {
    if (aquecimentoInflight.get(canalKey) === tarefa) {
      aquecimentoInflight.delete(canalKey)
    }
  })
}

/**
 * Galeria do drawer do canal: thumbs imediatas + assinadas em paralelo (sem probe lento).
 */
export function aquecerGaleriaMidiaCanal(
  supabase: SupabaseClient,
  rows: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
): void {
  if (typeof window === 'undefined' || rows.length === 0) return
  primarCacheMiniaturasChatCanal(supabase, rows, { limit: rows.length })
  const imagens = rows.filter((r) => r.anexo_url && ehAnexoImagemCanal(r.anexo_url, r.anexo_tipo)).slice(0, 60)
  void Promise.all(
    imagens.map(async (r) => {
      const anexoUrl = String(r.anexo_url)
      const signed = await resolverUrlAnexoMensagemCanal(supabase, anexoUrl, { forceSigned: true }).catch(
        () => null,
      )
      const path = extrairPathBucketMensagens(anexoUrl)
      if (path && signed) {
        cacheUrlChat.set(path, { url: signed, expira: Date.now() + TTL_CHAT_MS })
        prefetchUrlNoNavegador(signed, 'low')
      }
    }),
  )
}

/** @deprecated Use `prepararImagensChatCanal`. Mantido para mensagens novas em tempo real. */
export function prefetchImagensAnexosCanal(
  supabase: SupabaseClient,
  mensagens: Array<{ anexo_url: string | null; anexo_tipo: string | null }>,
  limit = 16,
): void {
  void prepararImagensChatCanal(supabase, mensagens, { limit })
}

/** Limpa caches em memória (ex.: logout). */
export function limparAquecimentoImagensCanais(): void {
  aquecimentoInflight.clear()
  cacheSignedUrl.clear()
  cacheUrlChat.clear()
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
