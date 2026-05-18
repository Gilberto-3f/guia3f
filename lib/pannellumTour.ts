import type { CenaTour360, CenaView360, StatusConexaoTour, TourConfig } from '@/lib/tour360Types'
import { TOUR_CONFIG_VAZIO } from '@/lib/tour360Types'

/** Pitch padrão para setas de navegação (nível porta/chão). */
export const PITCH_HOTSPOT_NAVEGACAO = -12

export const PANNELLUM_CSS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css'
export const PANNELLUM_JS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js'

/** Parâmetros de visualização — reduzem distorção percebida e forçam carregamento imediato. */
export const PANNELLUM_VIEW_DEFAULTS: Record<string, unknown> = {
  type: 'equirectangular',
  autoLoad: true,
  autoRotate: 0,
  compass: false,
  showZoomCtrl: true,
  showFullscreenCtrl: false,
  hfov: 100,
  minHfov: 50,
  maxHfov: 120,
  horizonPitch: 0,
  horizonRoll: 0,
}

/** @type {Promise<void> | null} */
let cssPromise: Promise<void> | null = null
/** @type {Promise<void> | null} */
let jsPromise: Promise<void> | null = null

const preloadCache = new Map<string, Promise<void>>()

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

/** Pré-carrega panorama para evitar tela "Click to Load". */
export function preloadPanorama(url: string): Promise<void> {
  const u = url?.trim()
  if (!u) return Promise.resolve()
  const cached = preloadCache.get(u)
  if (cached) return cached

  const p = new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Falha ao pré-carregar panorama'))
    img.src = u
  })
    .catch((err) => {
      preloadCache.delete(u)
      throw err
    })
    .finally(() => {
      /* mantém cache em sucesso */
    })

  preloadCache.set(u, p)
  return p
}

export type PannellumViewer = {
  destroy?: () => void
  on?: (event: string, fn: (ev?: unknown) => void) => void
  mouseEventToCoords?: (ev: MouseEvent) => [number, number]
  getPitch?: () => number
  getYaw?: () => number
  setPitch?: (pitch: number) => void
  setYaw?: (yaw: number) => void
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

function viewToPannellumParams(view?: CenaView360): Record<string, unknown> {
  if (!view) return {}
  const o: Record<string, unknown> = {}
  if (typeof view.pitch === 'number' && Number.isFinite(view.pitch)) o.pitch = view.pitch
  if (typeof view.yaw === 'number' && Number.isFinite(view.yaw)) o.yaw = view.yaw
  if (typeof view.hfov === 'number' && Number.isFinite(view.hfov)) o.hfov = view.hfov
  if (typeof view.horizonPitch === 'number' && Number.isFinite(view.horizonPitch)) {
    o.horizonPitch = view.horizonPitch
  }
  if (typeof view.horizonRoll === 'number' && Number.isFinite(view.horizonRoll)) {
    o.horizonRoll = view.horizonRoll
  }
  return o
}

function buildSceneConfig(cena: CenaTour360): Record<string, unknown> {
  return {
    ...PANNELLUM_VIEW_DEFAULTS,
    panorama: cena.url,
    ...viewToPannellumParams(cena.view),
    hotSpots: cena.hotspots.map((h) => ({
      id: h.id,
      pitch: h.pitch,
      yaw: h.yaw,
      type: 'scene',
      text: h.text?.trim() || 'Continuar',
      sceneId: h.sceneId,
    })),
  }
}

export function cenaIdFromUrl(url: string, index: number): string {
  const tail = url.split('/').pop() ?? ''
  const slug = tail.replace(/\W/g, '').slice(0, 16)
  return slug ? `cena_${slug}` : `cena_${index}`
}

function parseCenaView(raw: unknown): CenaView360 | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const v = raw as Record<string, unknown>
  const view: CenaView360 = {}
  let has = false
  for (const key of ['pitch', 'yaw', 'hfov', 'horizonPitch', 'horizonRoll'] as const) {
    if (typeof v[key] === 'number' && Number.isFinite(v[key])) {
      view[key] = v[key] as number
      has = true
    }
  }
  return has ? view : undefined
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
      view: parseCenaView(c.view),
    })
  }
  const firstScene = typeof o.firstScene === 'string' && o.firstScene.trim() ? o.firstScene.trim() : null
  return {
    firstScene: firstScene && cenas.some((c) => c.id === firstScene) ? firstScene : cenas[0]?.id ?? null,
    cenas,
  }
}

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

export function getPrimeiraCena(tour: TourConfig): CenaTour360 | null {
  if (!tour.cenas.length) return null
  const id = tour.firstScene && tour.cenas.some((c) => c.id === tour.firstScene) ? tour.firstScene : tour.cenas[0].id
  return tour.cenas.find((c) => c.id === id) ?? tour.cenas[0]
}

export function buildPannellumTourConfig(tour: TourConfig): Record<string, unknown> | null {
  if (!tour.cenas.length) return null
  const first =
    tour.firstScene && tour.cenas.some((c) => c.id === tour.firstScene) ? tour.firstScene : tour.cenas[0].id
  const scenes: Record<string, unknown> = {}
  for (const cena of tour.cenas) {
    scenes[cena.id] = buildSceneConfig(cena)
  }
  return {
    default: {
      firstScene: first,
      sceneFadeDuration: 500,
      autoLoad: true,
    },
    scenes,
  }
}

/** Config de uma cena para o editor (inclui hotspots de preview opcionais). */
export function buildPannellumEditorConfig(
  tour: TourConfig,
  cenaId: string,
  extraHotspots: Array<{ id: string; pitch: number; yaw: number; text?: string }> = []
): Record<string, unknown> | null {
  const cena = tour.cenas.find((c) => c.id === cenaId)
  if (!cena) return null
  const hotSpots = [
    ...cena.hotspots.map((h) => ({
      id: h.id,
      pitch: h.pitch,
      yaw: h.yaw,
      type: 'scene',
      text: h.text?.trim() || 'Continuar',
      sceneId: h.sceneId,
    })),
    ...extraHotspots.map((h) => ({
      id: h.id,
      pitch: h.pitch,
      yaw: h.yaw,
      type: 'info',
      text: h.text ?? 'Novo ponto',
    })),
  ]
  return {
    default: {
      firstScene: cena.id,
      sceneFadeDuration: 0,
      autoLoad: true,
    },
    scenes: {
      [cena.id]: {
        ...PANNELLUM_VIEW_DEFAULTS,
        panorama: cena.url,
        ...viewToPannellumParams(cena.view),
        hotSpots,
      },
    },
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

export const HOTSPOT_PREVIEW_ID = 'hs-preview-draft'

/** Yaw 0–360 (régua do editor) → posição horizontal % da imagem equiretangular. */
export function yawGrausParaPosicaoPercent(yawGraus: number): number {
  const n = ((yawGraus % 360) + 360) % 360
  return 50 - (n / 360) * 100
}

/** Converte yaw da régua (0–360) para yaw do Pannellum (-180–180). */
export function yawEditorParaPannellum(yawGraus: number): number {
  const n = ((yawGraus % 360) + 360) % 360
  return n > 180 ? n - 360 : n
}

/** Converte yaw Pannellum → régua 0–360. */
export function yawPannellumParaEditor(yaw: number): number {
  return ((yaw % 360) + 360) % 360
}

export function indiceAmbiente(tour: TourConfig, cenaId: string): number {
  const i = tour.cenas.findIndex((c) => c.id === cenaId)
  return i >= 0 ? i + 1 : 0
}

/** Lista status de conexões entre pares de ambientes. */
export function calcularStatusTour(tour: TourConfig): StatusConexaoTour[] {
  const linhas: StatusConexaoTour[] = []
  const n = tour.cenas.length
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const origem = tour.cenas[i]
      const destino = tour.cenas[j]
      const hs = origem.hotspots.find((h) => h.sceneId === destino.id)
      if (hs) {
        linhas.push({
          deIdx: i + 1,
          paraIdx: j + 1,
          deId: origem.id,
          paraId: destino.id,
          yaw: hs.yaw,
          estado: 'conectado',
        })
      }
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const temIda = tour.cenas[i].hotspots.some((h) => h.sceneId === tour.cenas[j].id)
      const temVolta = tour.cenas[j].hotspots.some((h) => h.sceneId === tour.cenas[i].id)
      if (temIda && !temVolta) {
        const ja = linhas.some(
          (l) => l.deIdx === j + 1 && l.paraIdx === i + 1 && l.estado === 'pendente'
        )
        if (!ja) {
          linhas.push({
            deIdx: j + 1,
            paraIdx: i + 1,
            deId: tour.cenas[j].id,
            paraId: tour.cenas[i].id,
            estado: 'pendente',
          })
        }
      }
    }
  }
  return linhas.sort((a, b) => a.deIdx - b.deIdx || a.paraIdx - b.paraIdx)
}
