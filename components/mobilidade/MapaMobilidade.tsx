'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import CardPinEmpresaMapa from '@/components/mobilidade/CardPinEmpresaMapa'
import PopupProfissionalMapaMobilidade from '@/components/mobilidade/PopupProfissionalMapaMobilidade'
import { type EmpresaMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'
import type { VisitanteParceriaMapa } from '@/lib/mobilidadeMapaVisitante'
import { podeIndicarAtrativoMapa, type ContextoMapaMobilidade } from '@/lib/parceriaMapaMobilidade'
import {
  COR_STATUS_MOBILIDADE,
  type ProfissionalOnlineMapa,
} from '@/lib/mobilidadeStatusProfissional'

const SOURCE_PROFS = 'profissionais-mobilidade'
const LAYER_PROFS = 'profissionais-unclustered'
/** Limite de pins HTML para manter o mapa leve. */
const MAX_PINS_EMPRESA = 120

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
  const markersRotaRef = useRef<mapboxgl.Marker[]>([])
  const markersEmpresaRef = useRef<mapboxgl.Marker[]>([])
  const [tokenMissing, setTokenMissing] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [selecionada, setSelecionada] = useState<EmpresaMapaMobilidade | null>(null)
  const [profSelecionado, setProfSelecionado] = useState<ProfissionalOnlineMapa | null>(null)
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
          paint: {
            'circle-color': ['get', 'cor'],
            'circle-radius': 11,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#111827',
          },
        })

        map.on('click', LAYER_PROFS, (e) => {
          const id = String(e.features?.[0]?.properties?.id ?? '')
          const prof = profissionaisRef.current.find((x) => x.id === id) ?? null
          setSelecionada(null)
          setProfSelecionado(prof)
        })

        map.on('mouseenter', LAYER_PROFS, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', LAYER_PROFS, () => {
          map.getCanvas().style.cursor = ''
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

    const lista = empresas.slice(0, MAX_PINS_EMPRESA)
    for (const emp of lista) {
      if (!Number.isFinite(emp.latitude) || !Number.isFinite(emp.longitude)) continue
      const el = criarElPinEmpresa(emp, () => {
        setProfSelecionado(null)
        setSelecionada(emp)
      })
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([emp.longitude, emp.latitude])
        .addTo(map)
      markersEmpresaRef.current.push(marker)
    }
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

      {mapReady && empresas.length === 0 ? (
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
