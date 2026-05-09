'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { usePublicidade, type PeriodoReserva } from '../../hooks/usePublicidade'
import ModalConfirmacao from '../shared/ModalConfirmacao'

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function diasDoPeriodo(p: PeriodoReserva): number {
  return p === '7d' ? 7 : p === '15d' ? 15 : 30
}

export default function Publicidade() {
  const { dados: empresa } = useDashboardEmpresa()
  const { anuncios, reservas, vagasDisponiveis, loading, error, publicarAnuncioHome, cancelarReserva } =
    usePublicidade(empresa?.id ?? null)

  const [periodo, setPeriodo] = useState<PeriodoReserva>('30d')
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [linkDestino, setLinkDestino] = useState('')

  const [modalCancelar, setModalCancelar] = useState<{ aberto: boolean; reservaId: string | null }>({
    aberto: false,
    reservaId: null,
  })
  const [cancelando, setCancelando] = useState(false)

  const [arteFile, setArteFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRevokeRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const vagaHome = useMemo(() => vagasDisponiveis.find((v) => v.vaga === 'vaga_1'), [vagasDisponiveis])
  const disponivel = Boolean(vagaHome?.disponivel)

  const periodoResumo = useMemo(() => {
    const hoje = new Date()
    const fim = new Date(hoje)
    fim.setDate(fim.getDate() + diasDoPeriodo(periodo))
    return `${formatDate(hoje.toISOString().slice(0, 10))} → ${formatDate(fim.toISOString().slice(0, 10))}`
  }, [periodo])

  useEffect(() => {
    return () => {
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current)
        previewRevokeRef.current = null
      }
    }
  }, [])

  const onArteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (previewRevokeRef.current) {
      URL.revokeObjectURL(previewRevokeRef.current)
      previewRevokeRef.current = null
    }
    setArteFile(f)
    if (f) {
      const url = URL.createObjectURL(f)
      previewRevokeRef.current = url
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
  }

  /** TMP: exigência de plano Premium/Enterprise desativada para testes (repor na dashboard ADM). */
  const handleSalvarAnuncio = async () => {
    if (!disponivel) {
      setFeedback('⚠️ Já existe um anúncio ativo na Home para o período atual.')
      return
    }
    if (!arteFile) {
      setFeedback('⚠️ Selecione a imagem do anúncio (JPG, PNG ou WEBP).')
      return
    }
    setFeedback(null)
    setSalvando(true)
    try {
      await publicarAnuncioHome('vaga_1', periodo, arteFile, linkDestino)
      setFeedback('✅ Anúncio salvo e publicado na Home do Guia.')
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current)
        previewRevokeRef.current = null
      }
      setArteFile(null)
      setPreviewUrl(null)
      setLinkDestino('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setFormAberto(false)
    } catch {
      setFeedback('❌ Não foi possível salvar. Verifique a imagem, o link e tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarCancelar = async () => {
    if (!modalCancelar.reservaId) return
    setCancelando(true)
    try {
      await cancelarReserva(modalCancelar.reservaId)
      setFeedback('✅ Reserva cancelada.')
    } catch {
      setFeedback('❌ Não foi possível cancelar a reserva.')
    } finally {
      setCancelando(false)
      setModalCancelar({ aberto: false, reservaId: null })
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-500">Carregando...</div>

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-800">
        Erro ao carregar publicidade: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {feedback ? <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{feedback}</div> : null}

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">📢 Seus Anúncios</h3>
        {anuncios.length === 0 ? (
          <p className="py-4 text-center text-gray-500">Nenhum anúncio ativo</p>
        ) : (
          <div className="space-y-3">
            {anuncios.map((anuncio) => (
              <div key={anuncio.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{anuncio.tipo === 'home' ? 'Home (Guia)' : 'Feed'}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(anuncio.periodo_inicio)} - {formatDate(anuncio.periodo_fim)}
                    </p>
                    {anuncio.link_url ? (
                      <p className="mt-1 truncate text-xs text-[#0097b2]">{anuncio.link_url}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm">👁️ {anuncio.impressoes_exibidas.toLocaleString()} impressões</p>
                    <p className="text-sm">🖱️ {anuncio.cliques} cliques</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-2 font-bold text-[#001f3f]">🏠 Espaço na Home do Guia</h3>
        <p className="mb-3 text-sm text-gray-500">Um anúncio ativo por vez neste espaço.</p>

        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className={`text-sm font-medium ${disponivel ? 'text-green-700' : 'text-red-700'}`}>
            {disponivel ? '✅ Vaga disponível' : '🔴 Vaga ocupada'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setFormAberto((a) => !a)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-[#001f3f] hover:bg-gray-50"
          aria-expanded={formAberto}
        >
          <span>Reservar espaço na Home</span>
          {formAberto ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
          )}
        </button>

        {formAberto ? (
          <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-sm font-medium text-[#001f3f]">Arte do anúncio</p>
              <p className="mb-3 text-xs text-gray-500">JPG, PNG ou WEBP. Sugestão: 1200×600 px.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={onArteChange}
                disabled={!disponivel}
                className="block w-full max-w-md text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#0097b2] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-50"
              />
              {previewUrl ? (
                <div className="relative mt-4 aspect-[2/1] w-full max-w-md overflow-hidden rounded-lg border bg-white">
                  <Image src={previewUrl} alt="Pré-visualização" fill className="object-contain" unoptimized />
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="link-anuncio-home" className="mb-1 block text-sm font-medium text-[#001f3f]">
                Link do anúncio (opcional)
              </label>
              <input
                id="link-anuncio-home"
                type="text"
                inputMode="url"
                value={linkDestino}
                onChange={(e) => setLinkDestino(e.target.value)}
                disabled={!disponivel}
                placeholder="https://… ou /empresa/…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none ring-[#0097b2] focus:ring-2 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">URL externa ou caminho interno (ex.: página da empresa).</p>
            </div>

            <div>
              <label htmlFor="periodo-anuncio" className="mb-1 block text-sm font-medium text-[#001f3f]">
                Período (duração)
              </label>
              <select
                id="periodo-anuncio"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as PeriodoReserva)}
                disabled={!disponivel}
                className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-100"
              >
                <option value="7d">7 dias (a partir de hoje)</option>
                <option value="15d">15 dias</option>
                <option value="30d">30 dias</option>
              </select>
              <p className="mt-2 text-xs text-gray-600">
                Vigência: <span className="font-medium text-[#001f3f]">{periodoResumo}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleSalvarAnuncio()}
              disabled={salvando || !disponivel}
              className="w-full rounded-lg bg-[#0097b2] px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar anúncio'}
            </button>
          </div>
        ) : null}
      </div>

      {reservas.length > 0 ? (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-4 font-bold text-[#001f3f]">⏳ Reservas antecipadas</h3>
          <div className="space-y-2">
            {reservas.map((reserva) => (
              <div key={reserva.id} className="flex items-center justify-between gap-3 border-b pb-2">
                <div>
                  <p className="font-medium">{reserva.vaga === 'vaga_1' ? 'VAGA 1' : 'VAGA 2'}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(reserva.periodo_inicio)} - {formatDate(reserva.periodo_fim)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-sm ${
                      reserva.status === 'pendente'
                        ? 'bg-yellow-100 text-yellow-800'
                        : reserva.status === 'confirmada'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {reserva.status === 'pendente'
                      ? 'Aguardando confirmação'
                      : reserva.status === 'confirmada'
                        ? 'Confirmada'
                        : 'Cancelada'}
                  </span>
                  {reserva.status === 'pendente' ? (
                    <button
                      type="button"
                      onClick={() => setModalCancelar({ aberto: true, reservaId: reserva.id })}
                      className="text-sm font-semibold text-red-600 hover:text-red-800"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ModalConfirmacao
        aberto={modalCancelar.aberto}
        titulo="Cancelar reserva?"
        descricao="A reserva será marcada como cancelada."
        confirmarLabel="Cancelar reserva"
        confirmando={cancelando}
        onConfirmar={() => void confirmarCancelar()}
        onCancelar={() => setModalCancelar({ aberto: false, reservaId: null })}
      />
    </div>
  )
}
