'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  buildPannellumTourConfig,
  getPannellum,
  loadPannellumAssets,
  novoHotspotId,
  parseTourConfig,
  sincronizarTourComFotos,
} from '@/lib/pannellumTour'
import { patchEmpresaTour360 } from '@/lib/tour360Api'

/**
 * Editor de tour 360° (admin): hotspots entre cenas.
 *
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
  const [formHotspot, setFormHotspot] = useState(/** @type {{ pitch: number, yaw: number, sceneId: string, text: string } | null} */ (null))
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(/** @type {string | null} */ (null))

  const reactDomId = useId().replace(/:/g, '')
  const viewerId = `pannellum-editor-${reactDomId}`
  const viewerRef = useRef(/** @type {import('@/lib/pannellumTour').PannellumViewer | null} */ (null))

  useEffect(() => {
    const synced = sincronizarTourComFotos(urls, parseTourConfig(tourRaw))
    setTour(synced)
    setCenaAtivaId((prev) => (synced.cenas.some((c) => c.id === prev) ? prev : synced.cenas[0]?.id ?? ''))
  }, [urls, tourRaw])

  const cenaAtiva = tour.cenas.find((c) => c.id === cenaAtivaId) ?? tour.cenas[0]
  const outrasCenas = tour.cenas.filter((c) => c.id !== cenaAtiva?.id)

  const montarConfigEditor = useCallback(() => {
    if (!cenaAtiva) return null
    return buildPannellumTourConfig({
      ...tour,
      firstScene: cenaAtiva.id,
    })
  }, [cenaAtiva, tour])

  useEffect(() => {
    if (!cenaAtiva) return
    let cancelado = false

    const run = async () => {
      try {
        await loadPannellumAssets()
        if (cancelado) return
        const Pannellum = getPannellum()
        const config = montarConfigEditor()
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

        if (modoAdicionar && viewer.on && viewer.mouseEventToCoords) {
          viewer.on('mousedown', (ev) => {
            if (!modoAdicionar) return
            const coords = viewer.mouseEventToCoords?.(ev)
            if (!coords || coords.length < 2) return
            const [pitch, yaw] = coords
            setFormHotspot({
              pitch,
              yaw,
              sceneId: outrasCenas[0]?.id ?? '',
              text: '',
            })
            setModoAdicionar(false)
          })
        }
      } catch {
        /* ignore */
      }
    }

    void run()

    return () => {
      cancelado = true
      if (viewerRef.current?.destroy) {
        try {
          viewerRef.current.destroy()
        } catch {
          /* ignore */
        }
      }
      viewerRef.current = null
      const el = document.getElementById(viewerId)
      if (el) el.innerHTML = ''
    }
  }, [cenaAtiva, viewerId, montarConfigEditor, modoAdicionar, outrasCenas])

  const atualizarHotspotsCena = (hotspots) => {
    if (!cenaAtiva) return
    setTour((prev) => ({
      ...prev,
      cenas: prev.cenas.map((c) => (c.id === cenaAtiva.id ? { ...c, hotspots } : c)),
    }))
  }

  const confirmarHotspot = () => {
    if (!formHotspot || !cenaAtiva) return
    if (!formHotspot.sceneId || formHotspot.sceneId === cenaAtiva.id) {
      setMsg('Escolha outro ambiente como destino.')
      return
    }
    const novo = {
      id: novoHotspotId(),
      pitch: formHotspot.pitch,
      yaw: formHotspot.yaw,
      sceneId: formHotspot.sceneId,
      text: formHotspot.text.trim() || undefined,
    }
    atualizarHotspotsCena([...cenaAtiva.hotspots, novo])
    setFormHotspot(null)
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
              setFormHotspot(null)
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
            <div id={viewerId} className="h-[min(50vh,400px)] w-full" />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!outrasCenas.length}
              onClick={() => {
                setModoAdicionar(true)
                setFormHotspot(null)
                setMsg(outrasCenas.length ? null : 'Adicione pelo menos duas imagens para conectar ambientes.')
              }}
              className="rounded-lg border border-[#0097b2] bg-white px-3 py-1.5 text-xs font-semibold text-[#0097b2] disabled:opacity-50"
            >
              {modoAdicionar ? 'Clique na imagem…' : '+ Ponto de navegação'}
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

          {formHotspot ? (
            <div className="mb-3 rounded-lg border border-[#0097b2]/30 bg-white p-3 text-xs">
              <p className="mb-2 font-medium text-gray-800">Novo ponto (pitch {formHotspot.pitch.toFixed(1)}, yaw {formHotspot.yaw.toFixed(1)})</p>
              <label className="mb-2 block">
                Ir para:
                <select
                  value={formHotspot.sceneId}
                  onChange={(e) => setFormHotspot((f) => (f ? { ...f, sceneId: e.target.value } : f))}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                >
                  {outrasCenas.map((c, i) => (
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
                  value={formHotspot.text}
                  onChange={(e) => setFormHotspot((f) => (f ? { ...f, text: e.target.value } : f))}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  placeholder="Ex.: Ir para o quarto"
                />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={confirmarHotspot} className="rounded-lg bg-[#0097b2] px-3 py-1.5 text-white">
                  Adicionar
                </button>
                <button type="button" onClick={() => setFormHotspot(null)} className="rounded-lg border border-gray-300 px-3 py-1.5">
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {cenaAtiva.hotspots.length > 0 ? (
            <ul className="mb-3 space-y-1 text-xs">
              {cenaAtiva.hotspots.map((h) => {
                const dest = tour.cenas.find((c) => c.id === h.sceneId)
                const destIdx = dest ? tour.cenas.findIndex((c) => c.id === dest.id) + 1 : '?'
                return (
                  <li key={h.id} className="flex items-center justify-between rounded bg-white px-2 py-1 ring-1 ring-black/5">
                    <span>
                      → Ambiente {destIdx}
                      {h.text ? ` (${h.text})` : ''}
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
