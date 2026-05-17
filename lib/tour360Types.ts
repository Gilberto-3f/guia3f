export type HotspotTour360 = {
  id: string
  pitch: number
  yaw: number
  sceneId: string
  text?: string
}

export type CenaTour360 = {
  id: string
  url: string
  label?: string
  hotspots: HotspotTour360[]
}

export type TourConfig = {
  firstScene: string | null
  cenas: CenaTour360[]
}

export const TOUR_CONFIG_VAZIO: TourConfig = {
  firstScene: null,
  cenas: [],
}
