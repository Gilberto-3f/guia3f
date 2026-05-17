import type { CenaTour360, TourConfig } from '@/lib/tour360Types'
import { TOUR_CONFIG_VAZIO } from '@/lib/tour360Types'

export const PANNELLUM_CSS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css'
export const PANNELLUM_JS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js'

/** @type {Promise<void> | null} */
let cssPromise: Promise<void> | null = null
/** @type {Promise<void> | null} */
let jsPromise: Promise<void> | null = null

export function loadPannellumAssets(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()

  if (!cssPromise) {
    cssPromise = new Promise((resolve) => {
      if (document.querySelector('link[data-pannellum-css="1"]')) {
        resolve()
        return
      }
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = PANNELLUM_CSS
      l.setAttribute('data-pannellum-css', '1')
      l.onload = () => resolve()
      l.onerror = () => resolve()
      document.head.appendChild(l)
    })
  }

  if (!jsPromise) {
    jsPromise = new Promise((resolve, reject) => {
      if ((window as Window & { pannellum?: unknown }).pannellum) {
        resolve()
        return
      }
      const s = document.createElement('script')
      s.src = PANNELLUM_JS
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Pannellum'))
      document.body.appendChild(s)
    })
  }

  return Promise.all([cssPromise, jsPromise]).then(() => {})
}

export type PannellumViewer = {
  destroy?: () => void
  on?: (event: string, fn: (ev: MouseEvent) => void) => void
  mouseEventToCoords?: (ev: MouseEvent) => [number, number]
  getConfig?: () => { hotSpots?: unknown[] }
  addHotSpot?: (hs: Record<string, unknown>, sceneId?: string) => void
  removeHotSpot?: (id: string, sceneId?: string) => void
  loadScene?: (sceneId: string) => void
}

export type PannellumApi = {
  viewer: (target: string, config: Record<string, unknown>) => PannellumViewer
}

export function getPannellum(): PannellumApi | null {
  if (typeof window === 'undefined') return null
  return (window as Window & { pannellum?: PannellumApi }).pannellum ?? null
}

export function cenaIdFromUrl(url: string, index: number): string {
  const tail = url.split('/').pop() ?? ''
  const slug = tail.replace(/\W/g, '').slice(0, 16)
  return slug ? `cena_${slug}` : `cena_${index}`
}

export function parseTourConfig(raw: unknown): TourConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...TOUR_CONFIG_VAZIO }
  const o = raw as Record<string, unknown>
  const cenasRaw = Array.isArray(o.cenas) ? o.cenas : []
  const cenas: CenaTour360[] = []
  for (const item of cenasRaw) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    const url = typeof c.url === 'string' ? c.url.trim() : ''
    const id = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : ''
    if (!url || !id) continue
    const hotspotsRaw = Array.isArray(c.hotspots) ? c.hotspots : []
    const hotspots = hotspotsRaw
      .map((h) => {
        if (!h || typeof h !== 'object') return null
        const x = h as Record<string, unknown>
        const hid = typeof x.id === 'string' ? x.id : ''
        const sceneId = typeof x.sceneId === 'string' ? x.sceneId : ''
        if (!hid || !sceneId) return null
        return {
          id: hid,
          pitch: Number(x.pitch) || 0,
          yaw: Number(x.yaw) || 0,
          sceneId,
          text: typeof x.text === 'string' ? x.text : undefined,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
    cenas.push({
      id,
      url,
      label: typeof c.label === 'string' ? c.label : undefined,
      hotspots,
    })
  }
  const firstScene = typeof o.firstScene === 'string' && o.firstScene.trim() ? o.firstScene.trim() : null
  return {
    firstScene: firstScene && cenas.some((c) => c.id === firstScene) ? firstScene : cenas[0]?.id ?? null,
    cenas,
  }
}

/** Sincroniza cenas com fotos_360_url; remove órfãos; cria cenas sem hotspots se necessário. */
export function sincronizarTourComFotos(fotos: string[], tour: TourConfig): TourConfig {
  const urls = fotos.filter((u) => typeof u === 'string' && u.trim())
  const urlSet = new Set(urls)
  const cenasExistentes = tour.cenas.filter((c) => urlSet.has(c.url))
  const urlsComCena = new Set(cenasExistentes.map((c) => c.url))
  const novas: CenaTour360[] = [...cenasExistentes]
  urls.forEach((url, index) => {
    if (urlsComCena.has(url)) return
    novas.push({
      id: cenaIdFromUrl(url, index),
      url,
      hotspots: [],
    })
  })
  const idsValidos = new Set(novas.map((c) => c.id))
  const cenasLimpas = novas.map((c) => ({
    ...c,
    hotspots: c.hotspots.filter((h) => h.sceneId !== c.id && idsValidos.has(h.sceneId)),
  }))
  let firstScene = tour.firstScene
  if (!firstScene || !idsValidos.has(firstScene)) {
    firstScene = cenasLimpas[0]?.id ?? null
  }
  return { firstScene, cenas: cenasLimpas }
}

export function tourTemNavegacao(tour: TourConfig): boolean {
  return tour.cenas.some((c) => c.hotspots.length > 0)
}

export function buildPannellumTourConfig(tour: TourConfig): Record<string, unknown> | null {
  if (!tour.cenas.length) return null
  const first = tour.firstScene && tour.cenas.some((c) => c.id === tour.firstScene) ? tour.firstScene : tour.cenas[0].id
  const scenes: Record<string, unknown> = {}
  for (const cena of tour.cenas) {
    scenes[cena.id] = {
      type: 'equirectangular',
      panorama: cena.url,
      hotSpots: cena.hotspots.map((h) => ({
        pitch: h.pitch,
        yaw: h.yaw,
        type: 'scene',
        text: h.text?.trim() || 'Continuar',
        sceneId: h.sceneId,
      })),
    }
  }
  return {
    default: {
      firstScene: first,
      sceneFadeDuration: 800,
    },
    scenes,
  }
}

export function medirProporcaoImagem(file: File): Promise<{ width: number; height: number; ratio: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      URL.revokeObjectURL(url)
      resolve({
        width,
        height,
        ratio: height > 0 ? width / height : 0,
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem.'))
    }
    img.src = url
  })
}

export function validarProporcao360(ratio: number): boolean {
  return ratio >= 1.9 && ratio <= 2.1
}

export function storagePathFromPublicUrl(publicUrl: string): string | null {
  const marker = '/object/public/empresas/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0] ?? '')
}

export function novoHotspotId(): string {
  return `hs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
