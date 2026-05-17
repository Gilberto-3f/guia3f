'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  buildPannellumEditorConfig,
  getPannellum,
  HOTSPOT_PREVIEW_ID,
  loadPannellumAssets,
  novoHotspotId,
  parseTourConfig,
  preloadPanorama,
  sincronizarTourComFotos,
} from '@/lib/pannellumTour'
import { patchEmpresaTour360 } from '@/lib/tour360Api'

/**
 * @param {{
 *   empresaId: string
 *   fotos360Url: string[]
 *   tourConfig: import('@/lib/tour360Types').TourConfig | unknown
 *   onSalvo?: () => void
 * }} props
 */
export default function EditorTour360({ empresaId, fotos360Url, tourConfig: tourRaw, onSalvo }) {
  const urls = useMemo(
    () => (Array.isArray(fotos360Url) ? fotos360Url.filter((u) => typeof u === 'string' && u.trim()) : []),
    [fotos360Url]
  )

  const tourInicial = useMemo(() => sincronizarTourComFotos(urls, parseTourConfig(tourRaw)), [urls, tourRaw])
  const [tour, setTour] = useState(tourInicial)
  const [cenaAtivaId, setCenaAtivaId] = useState(tourInicial.cenas[0]?.id ?? '')
  const [modoAdicionar, setModoAdicionar] = useState(false)
  const [draftHotspot, setDraftHotspot] = useState(
    /** @type {{ pitch: number, yaw: number, sceneId: string, text: string } | null} */ (null)
  )
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(/** @type {string | null} */ (null))
  const [viewerPronto, setViewerPronto] = useState(false)

  const reactDomId = useId().replace(/:/g, '')
  const viewerId = `pannellum-editor-${reactDomId}`
  const viewerRef = useRef(/** @type {import('@/lib/pannellumTour').PannellumViewer | null} */ (null))
  const modoAdicionarRef = useRef(false)

  useEffect(() => {
    modoAdicionarRef.current = modoAdicionar
  }, [modoAdicionar])

  useEffect(() => {
    const synced = sincronizarTourComFotos(urls, parseTourConfig(tourRaw))
    setTour(synced)
    setCenaAtivaId((prev) => (synced.cenas.some((c) => c.id === prev) ? prev : synced.cenas[0]?.id ?? ''))
  }, [urls, tourRaw])

  const cenaAtiva = tour.cenas.find((c) => c.id === cenaAtivaId) ?? tour.cenas[0]
  const outrasCenas = tour.cenas.filter((c) => c.id !== cenaAtiva?.id)

  const hotspotsKey = cenaAtiva ? cenaAtiva.hotspots.map((h) => h.id).join(',') : ''
  const viewKey = JSON.stringify(cenaAtiva?.view ?? {})

  const initViewer = useCallback(async () => {
    if (!cenaAtiva) return
    setViewerPronto(false)
    try {
      try {
        await preloadPanorama(cenaAtiva.url)
      } catch {
        /* continua */
      }
      await loadPannellumAssets()
      const Pannellum = getPannellum()
      const config = buildPannellumEditorConfig(tour, cenaAtiva.id, [])
      if (!Pannellum || !config) return
      const el = document.getElementById(viewerId)
      if (!el) return
      if (viewerRef.current?.destroy) {
        try {
          viewerRef.current.destroy()
        } catch {
          /* ignore */
        }
        viewerRef.current = null
      }
      el.innerHTML = ''
      const viewer = Pannellum.viewer(viewerId, config)
      viewerRef.current = viewer
      viewer.on?.('load', () => setViewerPronto(true))
    } catch {
      setViewerPronto(false)
    }
  }, [cenaAtiva, tour, viewerId, viewKey, hotspotsKey])

  useEffect(() => {
    void initViewer()
    return () => {
      if (viewerRef.current?.destroy) {
        try {
          viewerRef.current.destroy()
        } catch {
          /* ignore */
        }
      }
      viewerRef.current = null
      setViewerPronto(false)
      const el = document.getElementById(viewerId)
      if (el) el.innerHTML = ''
    }
  }, [initViewer, viewerId])

  const aplicarPreviewHotspot = useCallback(
    (pitch, yaw) => {
      const viewer = viewerRef.current
      if (!viewer || !cenaAtiva) return
      try {
        viewer.removeHotSpot?.(HOTSPOT_PREVIEW_ID, cenaAtiva.id)
      } catch {
        /* ignore */
      }
      viewer.addHotSpot?.(
        {
          id: HOTSPOT_PREVIEW_ID,
          pitch,
          yaw,
          type: 'info',
          text: 'Novo ponto',
        },
        cenaAtiva.id
      )
    },
    [cenaAtiva]
  )

  useEffect(() => {
    if (!draftHotspot || !viewerPronto) return
    aplicarPreviewHotspot(draftHotspot.pitch, draftHotspot.yaw)
  }, [draftHotspot?.pitch, draftHotspot?.yaw, viewerPronto, aplicarPreviewHotspot, draftHotspot])

  const handleOverlayClick = (/** @type {React.MouseEvent<HTMLButtonElement>} */ e) => {
    if (!modoAdicionarRef.current) return
    const viewer = viewerRef.current
    if (!viewer?.mouseEventToCoords) return
    const coords = viewer.mouseEventToCoords(e.nativeEvent)
    if (!coords || coords.length < 2) return
    const [pitch, yaw] = coords
    setDraftHotspot({
      pitch,
      yaw,
      sceneId: outrasCenas[0]?.id ?? '',
      text: '',
    })
    setModoAdicionar(false)
    viewer.setPitch?.(pitch)
    viewer.setYaw?.(yaw)
  }

  const atualizarHotspotsCena = (hotspots) => {
    if (!cenaAtiva) return
    setTour((prev) => ({
      ...prev,
      cenas: prev.cenas.map((c) => (c.id === cenaAtiva.id ? { ...c, hotspots } : c)),
    }))
  }

  const atualizarViewCena = (patch) => {
    if (!cenaAtiva) return
    setTour((prev) => ({
      ...prev,
      cenas: prev.cenas.map((c) =>
        c.id === cenaAtiva.id ? { ...c, view: { ...c.view, ...patch } } : c
      ),
    }))
    const viewer = viewerRef.current
    if (patch.pitch != null) viewer?.setPitch?.(patch.pitch)
    if (patch.yaw != null) viewer?.setYaw?.(patch.yaw)
  }

  const capturarVisaoAtual = () => {
    const viewer = viewerRef.current
    if (!viewer || !cenaAtiva) return
    const pitch = viewer.getPitch?.() ?? cenaAtiva.view?.pitch ?? 0
    const yaw = viewer.getYaw?.() ?? cenaAtiva.view?.yaw ?? 0
    atualizarViewCena({ pitch, yaw })
    setMsg('Visão da cena guardada.')
  }

  const confirmarHotspot = () => {
    if (!draftHotspot || !cenaAtiva) return
    if (!draftHotspot.sceneId || draftHotspot.sceneId === cenaAtiva.id) {
      setMsg('Escolha outro ambiente como destino.')
      return
    }
    const novo = {
      id: novoHotspotId(),
      pitch: draftHotspot.pitch,
      yaw: draftHotspot.yaw,
      sceneId: draftHotspot.sceneId,
      text: draftHotspot.text.trim() || undefined,
    }
    atualizarHotspotsCena([...cenaAtiva.hotspots, novo])
    setDraftHotspot(null)
    setMsg(null)
  }

  const removerHotspot = (id) => {
    if (!cenaAtiva) return
    atualizarHotspotsCena(cenaAtiva.hotspots.filter((h) => h.id !== id))
  }

  const salvarTour = async () => {
    if (!empresaId) return
    setSalvando(true)
    setMsg(null)
    const synced = sincronizarTourComFotos(urls, tour)
    const res = await patchEmpresaTour360({
      empresaId,
      fotos_360_url: urls,
      tour_config: synced,
    })
    setSalvando(false)
    if (!res.ok) {
      setMsg(res.error ?? 'Erro ao salvar.')
      return
    }
    setTour(synced)
    setDraftHotspot(null)
    setMsg('Tour salvo.')
    onSalvo?.()
  }

  if (!urls.length) {
    return (
      <p className="border-t border-[#E0E0E0] bg-gray-50 px-3 py-3 text-xs text-gray-600">
        Carregue imagens 360° antes de editar o tour.
      </p>
    )
  }

  const view = cenaAtiva?.view ?? {}

  return (
    <div className="border-t border-[#E0E0E0] bg-gray-50 px-3 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">Editar tour</p>

      <div className="mb-3 flex flex-wrap gap-2">
        {tour.cenas.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCenaAtivaId(c.id)
              setDraftHotspot(null)
              setModoAdicionar(false)
            }}
            className={`rounded-lg px-2 py-1 text-xs font-medium ring-1 ${
              c.id === cenaAtiva?.id ? 'bg-[#0097b2] text-white ring-[#0097b2]' : 'bg-white text-gray-700 ring-black/10'
            }`}
          >
            Ambiente {idx + 1}
          </button>
        ))}
      </div>

      {cenaAtiva ? (
        <>
          <div className="relative mb-3 overflow-hidden rounded-xl bg-black">
            <div id={viewerId} className="h-[min(55vh,420px)] w-full" />
            {modoAdicionar ? (
              <button
                type="button"
                className="absolute inset-0 z-10 cursor-crosshair bg-transparent"
                aria-label="Clique na imagem para posicionar o ponto"
                onClick={handleOverlayClick}
              />
            ) : null}
            {modoAdicionar ? (
              <p className="pointer-events-none absolute bottom-2 left-0 right-0 z-20 text-center text-xs font-medium text-white drop-shadow">
                Toque no local onde o ponto deve aparecer
              </p>
            ) : null}
          </div>

          <div className="mb-3 space-y-3 rounded-lg border border-gray-200 bg-white p-3 text-xs">
            <p className="font-semibold text-gray-800">Campo de visão (ajuste fino)</p>
            <p className="text-gray-600">Arraste a imagem e use os controlos para nivelar o horizonte e definir o enquadramento.</p>
            <label className="flex items-center gap-2">
              <span className="w-24 shrink-0">Inclinação</span>
              <input
                type="range"
                min={-90}
                max={90}
                step={0.5}
                value={view.horizonPitch ?? 0}
                onChange={(e) => atualizarViewCena({ horizonPitch: Number(e.target.value) })}
                className="min-w-0 flex-1"
              />
              <span className="w-10 tabular-nums">{(view.horizonPitch ?? 0).toFixed(1)}°</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24 shrink-0">Rotação</span>
              <input
                type="range"
                min={-30}
                max={30}
                step={0.5}
                value={view.horizonRoll ?? 0}
                onChange={(e) => atualizarViewCena({ horizonRoll: Number(e.target.value) })}
                className="min-w-0 flex-1"
              />
              <span className="w-10 tabular-nums">{(view.horizonRoll ?? 0).toFixed(1)}°</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24 shrink-0">Zoom (hfov)</span>
              <input
                type="range"
                min={50}
                max={120}
                step={1}
                value={view.hfov ?? 100}
                onChange={(e) => atualizarViewCena({ hfov: Number(e.target.value) })}
                className="min-w-0 flex-1"
              />
              <span className="w-10 tabular-nums">{view.hfov ?? 100}</span>
            </label>
            <button
              type="button"
              onClick={capturarVisaoAtual}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-800 hover:bg-gray-50"
            >
              Guardar visão atual da cena
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!outrasCenas.length}
              onClick={() => {
                setModoAdicionar(true)
                setDraftHotspot(null)
                setMsg(outrasCenas.length ? null : 'Adicione pelo menos duas imagens para conectar ambientes.')
              }}
              className="rounded-lg border border-[#0097b2] bg-white px-3 py-1.5 text-xs font-semibold text-[#0097b2] disabled:opacity-50"
            >
              {modoAdicionar ? 'Toque na imagem…' : '+ Ponto de navegação'}
            </button>
            <label className="flex items-center gap-1 text-xs text-gray-600">
              Cena inicial:
              <select
                value={tour.firstScene ?? ''}
                onChange={(e) => setTour((p) => ({ ...p, firstScene: e.target.value || null }))}
                className="rounded border border-gray-300 px-1 py-0.5 text-xs"
              >
                {tour.cenas.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    Ambiente {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {draftHotspot ? (
            <div className="mb-3 rounded-lg border border-[#0097b2]/30 bg-white p-3 text-xs">
              <p className="mb-2 font-medium text-gray-800">Posição do ponto de navegação</p>
              <label className="mb-2 flex items-center gap-2">
                <span className="w-14 shrink-0">Pitch</span>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  step={0.5}
                  value={draftHotspot.pitch}
                  onChange={(e) =>
                    setDraftHotspot((f) => (f ? { ...f, pitch: Number(e.target.value) } : f))
                  }
                  className="min-w-0 flex-1"
                />
                <span className="w-10 tabular-nums">{draftHotspot.pitch.toFixed(1)}°</span>
              </label>
              <label className="mb-2 flex items-center gap-2">
                <span className="w-14 shrink-0">Yaw</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={0.5}
                  value={draftHotspot.yaw}
                  onChange={(e) =>
                    setDraftHotspot((f) => (f ? { ...f, yaw: Number(e.target.value) } : f))
                  }
                  className="min-w-0 flex-1"
                />
                <span className="w-10 tabular-nums">{draftHotspot.yaw.toFixed(1)}°</span>
              </label>
              <label className="mb-2 block">
                Ir para:
                <select
                  value={draftHotspot.sceneId}
                  onChange={(e) => setDraftHotspot((f) => (f ? { ...f, sceneId: e.target.value } : f))}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                >
                  {outrasCenas.map((c) => (
                    <option key={c.id} value={c.id}>
                      Ambiente {tour.cenas.findIndex((x) => x.id === c.id) + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-2 block">
                Texto (opcional):
                <input
                  type="text"
                  value={draftHotspot.text}
                  onChange={(e) => setDraftHotspot((f) => (f ? { ...f, text: e.target.value } : f))}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  placeholder="Ex.: Ir para o quarto"
                />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={confirmarHotspot} className="rounded-lg bg-[#0097b2] px-3 py-1.5 text-white">
                  Confirmar ponto
                </button>
                <button type="button" onClick={() => setDraftHotspot(null)} className="rounded-lg border border-gray-300 px-3 py-1.5">
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {cenaAtiva.hotspots.length > 0 ? (
            <ul className="mb-3 space-y-1 text-xs">
              {cenaAtiva.hotspots.map((h) => {
                const destIdx = tour.cenas.findIndex((c) => c.id === h.sceneId) + 1
                return (
                  <li key={h.id} className="flex items-center justify-between rounded bg-white px-2 py-1 ring-1 ring-black/5">
                    <span>
                      → Ambiente {destIdx > 0 ? destIdx : '?'}
                      {h.text ? ` (${h.text})` : ''}
                      <span className="text-gray-500">
                        {' '}
                        · p{h.pitch.toFixed(0)} y{h.yaw.toFixed(0)}
                      </span>
                    </span>
                    <button type="button" onClick={() => removerHotspot(h.id)} className="text-red-600" aria-label="Remover ponto">
                      <Trash2 size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-gray-500">Nenhum ponto neste ambiente.</p>
          )}

          <button
            type="button"
            disabled={salvando}
            onClick={() => void salvarTour()}
            className="rounded-lg bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'A guardar…' : 'Salvar tour'}
          </button>
        </>
      ) : null}

      {msg ? <p className="mt-2 text-xs text-gray-700">{msg}</p> : null}
    </div>
  )
}
