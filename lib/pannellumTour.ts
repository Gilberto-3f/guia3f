import type { CenaTour360, CenaView360, StatusConexaoTour, TourConfig } from '@/lib/tour360Types'
import { TOUR_CONFIG_VAZIO } from '@/lib/tour360Types'

/** Pitch padrão para setas de navegação (nível porta/chão). */
export const PITCH_HOTSPOT_NAVEGACAO = -12

/** Classe no elemento pnlm-hotspot-base (Pannellum prefixa pnlm-hotspot-base automaticamente). */
export const CSS_HOTSPOT_NAVEGACAO = 'tour-nav-hotspot'

/**
 * Altura do panorama no editor (% do viewport).
 * Valor alto gera faixa horizontal larga para arrastar sem clipPath (sem faixas pretas).
 */
export const EDITOR_PANORAMA_BG_ALTURA_PERCENT = 320

const preloadCache = new Map<string, Promise<void>>()

/** Hotspots de navegação válidos para a cena (destino existente e diferente da origem). */
export function filtrarHotspotsNavegacao(cena: CenaTour360, idsCenasValidos: Set<string>) {
  return cena.hotspots.filter((h) => h.sceneId !== cena.id && idsCenasValidos.has(h.sceneId))
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
