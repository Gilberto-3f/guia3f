'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import CardPinEmpresaMapa from '@/components/mobilidade/CardPinEmpresaMapa'
import PopupProfissionalMapaMobilidade from '@/components/mobilidade/PopupProfissionalMapaMobilidade'
import {
  COR_PIN_SEGMENTO,
  type EmpresaMapaMobilidade,
} from '@/lib/mobilidadeMapaEmpresas'
import type { VisitanteParceriaMapa } from '@/lib/mobilidadeMapaVisitante'
import { podeIndicarAtrativoMapa, type ContextoMapaMobilidade } from '@/lib/parceriaMapaMobilidade'
import type { SegmentoEmpresaSlug } from '@/lib/segmentosEmpresaGuia'
import {
  COR_STATUS_MOBILIDADE,
  type ProfissionalOnlineMapa,
} from '@/lib/mobilidadeStatusProfissional'

const SOURCE_ID = 'empresas-mobilidade'
const SOURCE_PROFS = 'profissionais-mobilidade'
const LAYER_CLUSTERS = 'empresas-clusters'
const LAYER_CLUSTER_COUNT = 'empresas-cluster-count'
const LAYER_UNCLUSTERED = 'empresas-unclustered'
const LAYER_PROFS = 'profissionais-unclustered'

type Ponto = { lat: number; lng: number; label?: string }

type Props = {
  empresas: EmpresaMapaMobilidade[]
  profissionais?: ProfissionalOnlineMapa[]
  centro: { lat: number; lng: number } | null
  origem?: Ponto | null
  destino?: Ponto | null
  contextoMapa?: ContextoMapaMobilidade
  visitanteParceria?: VisitanteParceriaMapa | null
  className?: string
}

function empresasToGeoJSON(empresas: EmpresaMapaMobilidade[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: empresas.map((e) => ({
      type: 'Feature',
      properties: {
        id: e.id,
        segmento: e.segmento || 'passeios',
        cor: COR_PIN_SEGMENTO[(e.segmento || 'passeios') as SegmentoEmpresaSlug] ?? '#0097b2',
      },
      geometry: {
        type: 'Point',
        coordinates: [e.longitude, e.latitude],
      },
    })),
  }
}

function profissionaisToGeoJSON(lista: ProfissionalOnlineMapa[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lista.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        nome: p.nome_completo || p.nome_usuario || '',
        cor: COR_STATUS_MOBILIDADE[p.status],
      },
      geometry: {
        type: 'Point',
        coordinates: [p.lng, p.lat],
      },
    })),
  }
}

function waitForNonZeroSize(el: HTMLElement, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    if (el.clientWidth > 2 && el.clientHeight > 2) {
      resolve(true)
      return
    }
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      ro?.disconnect()
      window.clearTimeout(timer)
      resolve(ok)
    }
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (el.clientWidth > 2 && el.clientHeight > 2) finish(true)
          })
        : null
    ro?.observe(el)
    const timer = window.setTimeout(() => finish(el.clientWidth > 2 && el.clientHeight > 2), timeoutMs)
  })
}

export default function MapaMobilidade({
  empresas,
  profissionais = [],
  centro,
  origem = null,
  destino = null,
  contextoMapa = null,
  visitanteParceria = null,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [tokenMissing, setTokenMissing] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [selecionada, setSelecionada] = useState<EmpresaMapaMobilidade | null>(null)
  const [profSelecionado, setProfSelecionado] = useState<ProfissionalOnlineMapa | null>(null)
  const empresasRef = useRef(empresas)
  const profissionaisRef = useRef(profissionais)
  const centroRef = useRef(centro)
  empresasRef.current = empresas
  profissionaisRef.current = profissionais
  centroRef.current = centro

  const token = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() : ''

  const parceriaSelecionada =
    selecionada && contextoMapa === 'prof_parceiro' && visitanteParceria
      ? podeIndicarAtrativoMapa({
          visitantePlacaVermelha: visitanteParceria.placaVermelha,
          visitanteCategorias: visitanteParceria.categorias,
          visitanteCidadesAtuacao: visitanteParceria.cidadesAtuacao,
          empresaCidade: selecionada.cidade,
        })
      : null

  useEffect(() => {
    if (!token) {
      setTokenMissing(true)
      return
    }
    setTokenMissing(false)

    let cancelled = false
    let ro: ResizeObserver | null = null
    let t1 = 0
    let t2 = 0

    const boot = async () => {
      const el = containerRef.current
      if (!el || mapRef.current) return

      const sized = await waitForNonZeroSize(el)
      if (cancelled || !containerRef.current || mapRef.current) return
      if (!sized) {
        setMapError('Área do mapa sem altura. Recarregue a página.')
        return
      }

      mapboxgl.accessToken = token
      const start = centroRef.current ?? { lat: -25.516, lng: -54.585 }
      const map = new mapboxgl.Map({
        container: el,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [start.lng, start.lat],
        zoom: 12,
        attributionControl: true,
      })
      if (cancelled) {
        map.remove()
        return
      }
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
      mapRef.current = map

      const forceResize = () => {
        try {
          map.resize()
        } catch {
          /* ignore */
        }
      }

      forceResize()
      ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => forceResize()) : null
      ro?.observe(el)
      t1 = window.setTimeout(forceResize, 50)
      t2 = window.setTimeout(forceResize, 400)

      map.on('error', (e) => {
        const msg = String(
          (e as { error?: { message?: string } })?.error?.message ?? 'Erro ao carregar o Mapbox',
        )
        setMapError(msg)
      })

      map.on('load', () => {
        if (cancelled) return
        forceResize()
        setMapError(null)
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: empresasToGeoJSON(empresasRef.current),
          cluster: true,
          clusterMaxZoom: 11,
          clusterRadius: 50,
          clusterMinPoints: 3,
        })

        map.addLayer({
          id: LAYER_CLUSTERS,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#0097b2',
            'circle-radius': ['step', ['get', 'point_count'], 20, 10, 26, 30, 32],
            'circle-opacity': 0.95,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        })

        map.addLayer({
          id: LAYER_CLUSTER_COUNT,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 12,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#ffffff' },
        })

        map.addLayer({
          id: LAYER_UNCLUSTERED,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'cor'],
            'circle-radius': 11,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
          },
        })

        map.addSource(SOURCE_PROFS, {
          type: 'geojson',
          data: profissionaisToGeoJSON(profissionaisRef.current),
        })

        map.addLayer({
          id: LAYER_PROFS,
          type: 'circle',
          source: SOURCE_PROFS,
          paint: {
            'circle-color': ['get', 'cor'],
            'circle-radius': 11,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#111827',
          },
        })

        map.on('click', LAYER_CLUSTERS, (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_CLUSTERS] })
          const clusterId = features[0]?.properties?.cluster_id
          const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource
          if (clusterId == null || !source.getClusterExpansionZoom) return
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || zoom == null) return
            const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number]
            map.easeTo({ center: coords, zoom })
          })
        })

        map.on('click', LAYER_UNCLUSTERED, (e) => {
          const id = String(e.features?.[0]?.properties?.id ?? '')
          const emp = empresasRef.current.find((x) => x.id === id) ?? null
          setProfSelecionado(null)
          setSelecionada(emp)
        })

        map.on('click', LAYER_PROFS, (e) => {
          const id = String(e.features?.[0]?.properties?.id ?? '')
          const prof = profissionaisRef.current.find((x) => x.id === id) ?? null
          setSelecionada(null)
          setProfSelecionado(prof)
        })

        for (const layer of [LAYER_CLUSTERS, LAYER_UNCLUSTERED, LAYER_PROFS]) {
          map.on('mouseenter', layer, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', layer, () => {
            map.getCanvas().style.cursor = ''
          })
        }

        setMapReady(true)
        forceResize()
      })
    }

    void boot()

    return () => {
      cancelled = true
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      ro?.disconnect()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (source) source.setData(empresasToGeoJSON(empresas))
  }, [empresas, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const source = map.getSource(SOURCE_PROFS) as mapboxgl.GeoJSONSource | undefined
    if (source) source.setData(profissionaisToGeoJSON(profissionais))
  }, [profissionais, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !centro) return
    map.easeTo({ center: [centro.lng, centro.lat], zoom: Math.max(map.getZoom(), 12) })
  }, [centro, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    for (const m of markersRef.current) m.remove()
    markersRef.current = []

    const addMarker = (p: Ponto, color: string) => {
      const el = document.createElement('div')
      el.style.width = '14px'
      el.style.height = '14px'
      el.style.borderRadius = '9999px'
      el.style.background = color
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,.35)'
      if (p.label) el.title = p.label
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
      markersRef.current.push(marker)
    }

    if (origem && Number.isFinite(origem.lat) && Number.isFinite(origem.lng)) {
      addMarker(origem, '#00D443')
    }
    if (destino && Number.isFinite(destino.lat) && Number.isFinite(destino.lng)) {
      addMarker(destino, '#e11d48')
    }
  }, [origem, destino, mapReady])

  if (tokenMissing || !token) {
    return (
      <div
        className={`flex h-full min-h-[240px] w-full flex-col items-center justify-center bg-[#e8f4f6] px-6 text-center ${className}`}
      >
        <p className="text-base font-semibold text-[#0097b2]">Mapbox</p>
        <p className="mt-2 max-w-sm text-sm text-gray-600">
          Defina <code className="rounded bg-white px-1 text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> no{' '}
          <code className="rounded bg-white px-1 text-xs">.env.local</code> (dev) e nas Environment
          Variables da Vercel (produção), depois faça redeploy.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`mapa-mobilidade-root relative h-full min-h-[240px] w-full ${className}`}
      style={{ minHeight: 240 }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%', minHeight: 240 }}
      />
      <style>{`
        .mapa-mobilidade-root .mapboxgl-map,
        .mapa-mobilidade-root .mapboxgl-canvas-container,
        .mapa-mobilidade-root canvas.mapboxgl-canvas {
          width: 100% !important;
          height: 100% !important;
        }
        .mapa-mobilidade-root .mapboxgl-ctrl-bottom-right,
        .mapa-mobilidade-root .mapboxgl-ctrl-bottom-left {
          margin-bottom: 4.75rem;
        }
      `}</style>
      {mapError ? (
        <div className="absolute inset-x-3 top-3 z-30 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow">
          Mapa: {mapError}
        </div>
      ) : null}

      {selecionada ? (
        <CardPinEmpresaMapa empresa={selecionada} onFechar={() => setSelecionada(null)} />
      ) : null}

      {selecionada && parceriaSelecionada && !parceriaSelecionada.permitido && parceriaSelecionada.motivo ? (
        <p className="pointer-events-auto absolute inset-x-3 bottom-[calc(5.5rem+4.5rem)] z-30 mx-auto max-w-lg rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 shadow sm:left-1/2 sm:w-[min(100%-1.5rem,28rem)] sm:-translate-x-1/2">
          {parceriaSelecionada.motivo}
        </p>
      ) : null}

      {profSelecionado ? (
        <PopupProfissionalMapaMobilidade
          prof={profSelecionado}
          onFechar={() => setProfSelecionado(null)}
          visitanteParceria={visitanteParceria}
        />
      ) : null}
    </div>
  )
}
