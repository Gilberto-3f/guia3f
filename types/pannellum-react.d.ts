declare module 'pannellum-react' {
  import type { Component, ReactNode, Ref } from 'react'

  export interface PannellumHotspotProps {
    type: 'custom' | 'info'
    pitch?: number
    yaw?: number
    text?: string
    URL?: string
    cssClass?: string
    tooltip?: (div: HTMLElement) => void
    tooltipArg?: Record<string, unknown>
    handleClick?: (event?: unknown, args?: unknown) => void
    handleClickArg?: Record<string, unknown>
  }

  export interface PannellumProps {
    id?: string
    width?: string
    height?: string
    image?: string
    pitch?: number
    yaw?: number
    hfov?: number
    minHfov?: number
    maxHfov?: number
    autoLoad?: boolean
    autoRotate?: number
    compass?: boolean
    showZoomCtrl?: boolean
    showFullscreenCtrl?: boolean
    children?: ReactNode
    onLoad?: () => void
    onError?: () => void
    ref?: Ref<Pannellum>
  }

  export class Pannellum extends Component<PannellumProps> {
    static Hotspot: Component<PannellumHotspotProps>
    forceRender(): void
    getViewer(): unknown
  }

  export class PannellumVideo extends Component<Record<string, unknown>> {}
}
