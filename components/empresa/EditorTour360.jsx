'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import EditorTourViewport from '@/components/empresa/EditorTourViewport'
import {
  calcularStatusTour,
  indiceAmbiente,
  novoHotspotId,
  parseTourConfig,
  PITCH_HOTSPOT_NAVEGACAO,
  sincronizarTourComFotos,
  yawEditorParaPannellum,
  yawPannellumParaEditor,
} from '@/lib/pannellumTour'
import { patchEmpresaTour360 } from '@/lib/tour360Api'

/**
 * Editor visual do tour 360° (pino fixo no centro + régua; setas no tour via Pannellum).
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
  const [yawEditor, setYawEditor] = useState(0)
  const [destinoDraftId, setDestinoDraftId] = useState(/** @type {string | null} */ (null))
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    const synced = sincronizarTourComFotos(urls, parseTourConfig(tourRaw))
    setTour(synced)
    setCenaAtivaId((prev) => (synced.cenas.some((c) => c.id === prev) ? prev : synced.cenas[0]?.id ?? ''))
  }, [urls, tourRaw])

  const cenaAtiva = tour.cenas.find((c) => c.id === cenaAtivaId) ?? tour.cenas[0]
  const outrasCenas = tour.cenas.filter((c) => c.id !== cenaAtiva?.id)
  const statusLinhas = useMemo(() => calcularStatusTour(tour), [tour])

  const destinoIdx = destinoDraftId ? indiceAmbiente(tour, destinoDraftId) : null
  const hotspotExistenteDestino =
    cenaAtiva && destinoDraftId
      ? cenaAtiva.hotspots.find((h) => h.sceneId === destinoDraftId)
      : undefined

  useEffect(() => {
    if (!cenaAtiva) return
    if (destinoDraftId && hotspotExistenteDestino) {
      setYawEditor(yawPannellumParaEditor(hotspotExistenteDestino.yaw))
    } else if (!destinoDraftId) {
      setYawEditor(0)
    }
  }, [cenaAtiva?.id, destinoDraftId, hotspotExistenteDestino?.yaw, cenaAtiva])

  const selecionarAmbiente = (id) => {
    setCenaAtivaId(id)
    setDestinoDraftId(null)
    setYawEditor(0)
    setMsg(null)
  }

  const escolherDestinoNovo = (destinoId) => {
    setDestinoDraftId(destinoId)
    setModalNovoAberto(false)
    const existente = cenaAtiva?.hotspots.find((h) => h.sceneId === destinoId)
    if (existente) {
      setYawEditor(yawPannellumParaEditor(existente.yaw))
    } else {
      setYawEditor(0)
    }
    setMsg(null)
  }

  const conectar = () => {
    if (!cenaAtiva || !destinoDraftId) {
      setMsg('Toque em + NOVO e escolha o ambiente de destino.')
      return
    }
    if (destinoDraftId === cenaAtiva.id) {
      setMsg('Escolha outro ambiente.')
      return
    }
    const yaw = yawEditorParaPannellum(yawEditor)
    const semDestino = cenaAtiva.hotspots.filter((h) => h.sceneId !== destinoDraftId)
    const novo = {
      id: hotspotExistenteDestino?.id ?? novoHotspotId(),
      pitch: PITCH_HOTSPOT_NAVEGACAO,
      yaw,
      sceneId: destinoDraftId,
    }
    setTour((prev) => ({
      ...prev,
      cenas: prev.cenas.map((c) =>
        c.id === cenaAtiva.id ? { ...c, hotspots: [...semDestino, novo] } : c
      ),
    }))
    setMsg(`Ambiente ${indiceAmbiente(tour, cenaAtiva.id)} conectado com Ambiente ${indiceAmbiente(tour, destinoDraftId)} (${Math.round(yawEditor)}°).`)
  }

  const removerHotspot = (id) => {
    if (!cenaAtiva) return
    setTour((prev) => ({
      ...prev,
      cenas: prev.cenas.map((c) =>
        c.id === cenaAtiva.id ? { ...c, hotspots: c.hotspots.filter((h) => h.id !== id) } : c
      ),
    }))
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
    setMsg('Tour salvo e publicado.')
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
    <div className="border-t border-[#E0E0E0] bg-gray-50 px-3 py-4">
      <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-[#001f3f]">Editar tour</h3>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {tour.cenas.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selecionarAmbiente(c.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              c.id === cenaAtiva?.id
                ? 'bg-[#0097b2] text-white shadow-sm'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Ambiente {idx + 1}
          </button>
        ))}
      </div>

      {cenaAtiva ? (
        <>
          <div className="mb-2">
            <EditorTourViewport
              panoramaUrl={cenaAtiva.url}
              yawGraus={yawEditor}
              onYawChange={setYawEditor}
              numeroDestino={destinoIdx}
              destinoConectado={Boolean(destinoDraftId && hotspotExistenteDestino)}
            />
          </div>
          <p className="mb-4 text-center text-[11px] leading-snug text-gray-600">
            {destinoDraftId ? (
              <>
                O ponto no centro é onde a seta ficará na tour. Mova a foto com a régua até o local certo e toque em{' '}
                <strong>CONECTAR</strong> (ambiente {destinoIdx ?? '?'}).
              </>
            ) : (
              <>
                Toque em <strong>+ NOVO</strong>, escolha o ambiente de destino e use a régua para alinhar o ponto
                central.
              </>
            )}
          </p>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              disabled={outrasCenas.length === 0}
              onClick={() => setModalNovoAberto(true)}
              className="flex-1 rounded-lg border-2 border-[#0097b2] bg-white py-2.5 text-sm font-bold text-[#0097b2] disabled:opacity-50"
            >
              + NOVO
            </button>
            <button
              type="button"
              onClick={conectar}
              className="flex-1 rounded-lg bg-[#00D443] py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95"
            >
              CONECTAR
            </button>
          </div>

          <label className="mb-3 flex items-center justify-center gap-2 text-xs text-gray-600">
            Cena inicial do tour:
            <select
              value={tour.firstScene ?? ''}
              onChange={(e) => setTour((p) => ({ ...p, firstScene: e.target.value || null }))}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              {tour.cenas.map((c, i) => (
                <option key={c.id} value={c.id}>
                  Ambiente {i + 1}
                </option>
              ))}
            </select>
          </label>

          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 text-xs">
            <p className="mb-2 font-semibold text-gray-800">Status</p>
            {statusLinhas.length === 0 ? (
              <p className="text-gray-500">Nenhuma conexão configurada.</p>
            ) : (
              <ul className="space-y-1.5">
                {statusLinhas.map((linha, i) => (
                  <li key={`${linha.deIdx}-${linha.paraIdx}-${linha.estado}-${i}`}>
                    <span className="font-semibold text-gray-800">AMBIENTE {linha.deIdx}</span>{' '}
                    {linha.estado === 'conectado' ? (
                      <>
                        <span className="italic text-green-600">conectado com</span>{' '}
                        <span className="font-semibold text-gray-800">AMBIENTE {linha.paraIdx}</span>
                        {linha.yaw != null ? (
                          <span className="text-gray-500"> ({Math.round(yawPannellumParaEditor(linha.yaw))}°)</span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="italic text-red-600">pendente</span>{' '}
                        <span className="font-semibold text-gray-800">AMBIENTE {linha.paraIdx}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {cenaAtiva.hotspots.length > 0 ? (
            <ul className="mb-4 space-y-1 text-xs">
              <p className="font-medium text-gray-700">Pontos neste ambiente:</p>
              {cenaAtiva.hotspots.map((h) => {
                const para = indiceAmbiente(tour, h.sceneId)
                return (
                  <li
                    key={h.id}
                    className="flex items-center justify-between rounded bg-white px-2 py-1.5 ring-1 ring-black/5"
                  >
                    <button
                      type="button"
                      className="text-left text-gray-800 hover:text-[#0097b2]"
                      onClick={() => {
                        setDestinoDraftId(h.sceneId)
                        setYawEditor(yawPannellumParaEditor(h.yaw))
                      }}
                    >
                      → Ambiente {para} · {Math.round(yawPannellumParaEditor(h.yaw))}°
                    </button>
                    <button
                      type="button"
                      onClick={() => removerHotspot(h.id)}
                      className="text-red-600"
                      aria-label="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}

          <button
            type="button"
            disabled={salvando}
            onClick={() => void salvarTour()}
            className="w-full rounded-lg bg-[#0097b2] py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {salvando ? 'A guardar…' : 'Salvar tour'}
          </button>
        </>
      ) : null}

      {msg ? <p className="mt-3 text-center text-xs text-gray-700">{msg}</p> : null}

      {modalNovoAberto ? (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Escolher ambiente destino"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <p className="mb-3 text-center text-sm font-bold text-[#001f3f]">Conectar com qual ambiente?</p>
            <div className="flex flex-col gap-2">
              {outrasCenas.map((c) => {
                const idx = indiceAmbiente(tour, c.id)
                const ja = cenaAtiva.hotspots.some((h) => h.sceneId === c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => escolherDestinoNovo(c.id)}
                    className={`rounded-lg py-2.5 text-sm font-semibold ${
                      ja ? 'bg-green-50 text-green-800 ring-1 ring-green-300' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Ambiente {idx}
                    {ja ? ' (já conectado — reajustar)' : ''}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setModalNovoAberto(false)}
              className="mt-3 w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
