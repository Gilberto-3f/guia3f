'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import CardPinEmpresaMapa from '@/components/mobilidade/CardPinEmpresaMapa'
import { type EmpresaMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'
import type { VisitanteParceriaMapa } from '@/lib/mobilidadeMapaVisitante'
import { podeIndicarAtrativoMapa, type ContextoMapaMobilidade } from '@/lib/parceriaMapaMobilidade'
import { buscarRotaMapboxDriving, peekRotaDirectionsCache } from '@/lib/mapboxDirections'
import type { TipoIconeDeslocamento } from '@/lib/mobilidadeTrajetoMapa'
import {
  COR_STATUS_MOBILIDADE,
  type ProfissionalOnlineMapa,
} from '@/lib/mobilidadeStatusProfissional'

const SOURCE_PROFS = 'profissionais-mobilidade'
const LAYER_PROFS = 'profissionais-unclustered'
const SOURCE_TRAJETO = 'trajeto-corrida-mobilidade'
const LAYER_TRAJETO = 'trajeto-corrida-linha'
/** Limite de pins HTML para manter o mapa leve. */
const MAX_PINS_EMPRESA = 5000

type Ponto = { lat: number; lng: number; label?: string }

type Props = {
  empresas: EmpresaMapaMobilidade[]
  profissionais?: ProfissionalOnlineMapa[]
  centro: { lat: number; lng: number } | null
  origem?: Ponto | null
  destino?: Ponto | null
  /** Linha da corrida (profissional → partida ou partida → destino). */
  trajeto?: { de: Ponto; ate: Ponto } | null
  /** Ícone do profissional em deslocamento (carro / pessoa). */
  marcadorDeslocamento?: { lat: number; lng: number; tipo: TipoIconeDeslocamento } | null
  contextoMapa?: ContextoMapaMobilidade
  visitanteParceria?: VisitanteParceriaMapa | null
  /** Enquanto true, não mostra aviso de “nenhuma empresa”. */
  carregandoPins?: boolean
  /** Oculta aviso de empresas vazias (modo corrida profissional). */
  ocultarAvisoEmpresas?: boolean
  /** Etapa 4: atendimento imediato do pro — sem pins de empresa. */
  ocultarPinsEmpresas?: boolean
  className?: string
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

/** Pin: foto quadrada arredondada + borda branca. */
function criarElPinEmpresa(
  empresa: EmpresaMapaMobilidade,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.title = empresa.nome_fantasia || 'Empresa'
  btn.setAttribute('aria-label', empresa.nome_fantasia || 'Empresa')
  btn.style.cssText = [
    'width:44px',
    'height:44px',
    'padding:0',
    'margin:0',
    'border:3px solid #ffffff',
    'border-radius:12px',
    'overflow:hidden',
    'cursor:pointer',
    'box-shadow:0 2px 10px rgba(0,0,0,.4)',
    'background:#0097b2',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'color:#fff',
    'font-weight:700',
    'font-size:16px',
    'line-height:1',
  ].join(';')

  const foto = String(empresa.foto_url ?? '').trim()
  if (foto) {
    const img = document.createElement('img')
    img.src = foto
    img.alt = ''
    img.draggable = false
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none'
    img.onerror = () => {
      img.remove()
      btn.textContent = (empresa.nome_fantasia || '?').charAt(0).toUpperCase()
    }
    btn.appendChild(img)
  } else {
    btn.textContent = (empresa.nome_fantasia || '?').charAt(0).toUpperCase()
  }

  btn.addEventListener('click', (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    onClick()
  })
  return btn
}

const SVG_CARRO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>'

const SVG_PESSOA =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M9 22V16l-3-5 6-3 6 3-3 5v6"/><path d="M6 11l3 1"/><path d="M18 11l-3 1"/></svg>'

function criarElDeslocamento(tipo: TipoIconeDeslocamento): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'width:36px',
    'height:36px',
    'border-radius:9999px',
    'background:#0097b2',
    'border:3px solid #ffffff',
    'box-shadow:0 2px 10px rgba(0,0,0,.4)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';')
  el.innerHTML = tipo === 'pessoa' ? SVG_PESSOA : SVG_CARRO
  el.setAttribute('aria-hidden', 'true')
  return el
}

export default function MapaMobilidade({
  empresas,
  profissionais = [],
  centro,
  origem = null,
  destino = null,
  trajeto = null,
  marcadorDeslocamento = null,
  contextoMapa = null,
  visitanteParceria = null,
  carregandoPins = false,
  ocultarAvisoEmpresas = false,
  ocultarPinsEmpresas = false,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRotaRef = useRef<mapboxgl.Marker[]>([])
  const markersEmpresaRef = useRef<mapboxgl.Marker[]>([])
  const markerDeslocamentoRef = useRef<mapboxgl.Marker | null>(null)
  const tipoDeslocamentoRef = useRef<TipoIconeDeslocamento | null>(null)
  const rotaFitKeyRef = useRef<string>('')
  const [tokenMissing, setTokenMissing] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [selecionada, setSelecionada] = useState<EmpresaMapaMobilidade | null>(null)
  const profissionaisRef = useRef(profissionais)
  const centroRef = useRef(centro)
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

        map.addSource(SOURCE_PROFS, {
          type: 'geojson',
          data: profissionaisToGeoJSON(profissionaisRef.current),
        })

        map.addLayer({
          id: LAYER_PROFS,
          type: 'circle',
          source: SOURCE_PROFS,
          layout: {
            visibility: profissionaisRef.current.length > 0 ? 'visible' : 'none',
          },
          paint: {
            'circle-color': ['get', 'cor'],
            'circle-radius': 11,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#111827',
          },
        })

        // Clique no fundo do mapa fecha o card (pins HTML já usam stopPropagation)
        map.on('click', () => {
          setSelecionada(null)
        })

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
      for (const m of markersEmpresaRef.current) m.remove()
      markersEmpresaRef.current = []
      for (const m of markersRotaRef.current) m.remove()
      markersRotaRef.current = []
      markerDeslocamentoRef.current?.remove()
      markerDeslocamentoRef.current = null
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Pins HTML das empresas (foto + borda branca)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    for (const m of markersEmpresaRef.current) m.remove()
    markersEmpresaRef.current = []

    if (ocultarPinsEmpresas) {
      setSelecionada(null)
      return
    }

    const lista = empresas.slice(0, MAX_PINS_EMPRESA)
    for (const emp of lista) {
      if (!Number.isFinite(emp.latitude) || !Number.isFinite(emp.longitude)) continue
      const el = criarElPinEmpresa(emp, () => {
        setSelecionada(emp)
      })
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([emp.longitude, emp.latitude])
        .addTo(map)
      markersEmpresaRef.current.push(marker)
    }
  }, [empresas, mapReady, ocultarPinsEmpresas])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const source = map.getSource(SOURCE_PROFS) as mapboxgl.GeoJSONSource | undefined
    if (source) source.setData(profissionaisToGeoJSON(profissionais))
    if (map.getLayer(LAYER_PROFS)) {
      map.setLayoutProperty(LAYER_PROFS, 'visibility', profissionais.length > 0 ? 'visible' : 'none')
    }
  }, [profissionais, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !centro) return
    map.easeTo({ center: [centro.lng, centro.lat], zoom: Math.max(map.getZoom(), 12) })
  }, [centro, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    for (const m of markersRotaRef.current) m.remove()
    markersRotaRef.current = []

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
      markersRotaRef.current.push(marker)
    }

    if (origem && Number.isFinite(origem.lat) && Number.isFinite(origem.lng)) {
      addMarker(origem, '#00D443')
    }
    if (destino && Number.isFinite(destino.lat) && Number.isFinite(destino.lng)) {
      addMarker(destino, '#e11d48')
    }
  }, [origem, destino, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const limpar = () => {
      if (map.getLayer(LAYER_TRAJETO)) map.removeLayer(LAYER_TRAJETO)
      if (map.getSource(SOURCE_TRAJETO)) map.removeSource(SOURCE_TRAJETO)
    }

    const de = trajeto?.de
    const ate = trajeto?.ate
    if (
      !de ||
      !ate ||
      !Number.isFinite(de.lat) ||
      !Number.isFinite(de.lng) ||
      !Number.isFinite(ate.lat) ||
      !Number.isFinite(ate.lng)
    ) {
      limpar()
      rotaFitKeyRef.current = ''
      return
    }

    let cancelled = false
    const aplicar = (coordinates: [number, number][]) => {
      if (cancelled) return
      const geo: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates },
          },
        ],
      }
      const existing = map.getSource(SOURCE_TRAJETO) as mapboxgl.GeoJSONSource | undefined
      if (existing) {
        existing.setData(geo)
      } else {
        map.addSource(SOURCE_TRAJETO, { type: 'geojson', data: geo })
        map.addLayer({
          id: LAYER_TRAJETO,
          type: 'line',
          source: SOURCE_TRAJETO,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0097b2',
            'line-width': 4.5,
            'line-opacity': 0.95,
          },
        })
      }
      const fitKey = `${coordinates.length}:${coordinates[0]?.join(',')}:${coordinates[coordinates.length - 1]?.join(',')}`
      if (fitKey === rotaFitKeyRef.current) return
      rotaFitKeyRef.current = fitKey
      try {
        const bounds = new mapboxgl.LngLatBounds()
        for (const c of coordinates) bounds.extend(c)
        map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 600 })
      } catch {
        /* ignore */
      }
    }

    const cached = peekRotaDirectionsCache(de, ate)
    if (cached?.coordinates?.length) {
      aplicar(cached.coordinates)
    } else {
      aplicar([
        [de.lng, de.lat],
        [ate.lng, ate.lat],
      ])
    }

    void buscarRotaMapboxDriving(de, ate).then((rota) => {
      if (cancelled || !rota?.coordinates?.length) return
      aplicar(rota.coordinates)
    })

    return () => {
      cancelled = true
    }
  }, [trajeto, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const m = marcadorDeslocamento
    if (!m || !Number.isFinite(m.lat) || !Number.isFinite(m.lng)) {
      markerDeslocamentoRef.current?.remove()
      markerDeslocamentoRef.current = null
      tipoDeslocamentoRef.current = null
      return
    }

    const existente = markerDeslocamentoRef.current
    if (existente && tipoDeslocamentoRef.current === m.tipo) {
      existente.setLngLat([m.lng, m.lat])
      return
    }

    existente?.remove()
    const marker = new mapboxgl.Marker({
      element: criarElDeslocamento(m.tipo),
      anchor: 'center',
    })
      .setLngLat([m.lng, m.lat])
      .addTo(map)
    markerDeslocamentoRef.current = marker
    tipoDeslocamentoRef.current = m.tipo
  }, [marcadorDeslocamento, mapReady])

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

      {mapReady && !carregandoPins && !ocultarAvisoEmpresas && !ocultarPinsEmpresas && empresas.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-3 top-16 z-20 mx-auto max-w-sm rounded-lg bg-white/90 px-3 py-2 text-center text-[11px] text-gray-600 shadow">
          Nenhuma empresa com latitude/longitude cadastrada no Guia ainda.
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
    </div>
  )
}
