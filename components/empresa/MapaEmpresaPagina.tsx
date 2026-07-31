'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

type Props = {
  latitude: number
  longitude: number
  nome?: string | null
  fotoUrl?: string | null
  className?: string
}

function criarPinFoto(opts: { nome: string; fotoUrl: string | null }): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = [
    'width:44px',
    'height:44px',
    'border:3px solid #ffffff',
    'border-radius:12px',
    'overflow:hidden',
    'box-shadow:0 2px 10px rgba(0,0,0,.4)',
    'background:#0097b2',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'color:#fff',
    'font-weight:700',
    'font-size:16px',
    'pointer-events:none',
  ].join(';')

  const foto = String(opts.fotoUrl ?? '').trim()
  if (foto) {
    const img = document.createElement('img')
    img.src = foto
    img.alt = ''
    img.draggable = false
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'
    img.onerror = () => {
      img.remove()
      wrap.textContent = (opts.nome || '?').charAt(0).toUpperCase()
    }
    wrap.appendChild(img)
  } else {
    wrap.textContent = (opts.nome || '?').charAt(0).toUpperCase()
  }
  return wrap
}

/** Mapa Mapbox da página da empresa: só o pin desta empresa, sem card ao clicar. */
export default function MapaEmpresaPagina({
  latitude,
  longitude,
  nome = '',
  fotoUrl = null,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [tokenMissing, setTokenMissing] = useState(false)

  const token = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() : ''

  useEffect(() => {
    if (!token) {
      setTokenMissing(true)
      return
    }
    if (!containerRef.current || mapRef.current) return
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [longitude, latitude],
      zoom: 15,
      attributionControl: true,
      interactive: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    const pin = criarPinFoto({
      nome: String(nome ?? ''),
      fotoUrl: fotoUrl != null ? String(fotoUrl) : null,
    })
    markerRef.current = new mapboxgl.Marker({ element: pin, anchor: 'center' })
      .setLngLat([longitude, latitude])
      .addTo(map)

    const onLoad = () => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }
    map.on('load', onLoad)

    return () => {
      map.off('load', onLoad)
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [token, latitude, longitude, nome, fotoUrl])

  if (tokenMissing || !token) {
    return (
      <div
        className={`flex h-[min(280px,50vh)] items-center justify-center bg-[#e8f4f6] px-4 text-center text-sm text-gray-600 ${className}`}
      >
        Mapa indisponível (token Mapbox).
      </div>
    )
  }

  return (
    <div className={`relative h-[min(280px,50vh)] w-full overflow-hidden ${className}`}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
