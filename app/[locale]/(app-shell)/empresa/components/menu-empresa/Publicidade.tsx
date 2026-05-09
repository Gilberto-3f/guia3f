'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { usePublicidade } from '../../hooks/usePublicidade'
import ModalConfirmacao from '../shared/ModalConfirmacao'

type PeriodoReserva = '7d' | '15d' | '30d'

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

export default function Publicidade() {
  const { dados: empresa } = useDashboardEmpresa()
  const { anuncios, reservas, vagasDisponiveis, loading, error, publicarAnuncioHome, cancelarReserva } =
    usePublicidade(empresa?.id ?? null)

  const [periodo, setPeriodo] = useState<PeriodoReserva>('30d')
  const [reservando, setReservando] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [modalCancelar, setModalCancelar] = useState<{ aberto: boolean; reservaId: string | null }>({
    aberto: false,
    reservaId: null,
  })
  const [cancelando, setCancelando] = useState(false)

  const [arteFile, setArteFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRevokeRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const vagasHomeDisponiveis = useMemo(() => vagasDisponiveis.filter((v) => v.disponivel), [vagasDisponiveis])

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
  const handleReservar = async (vaga: string) => {
    if (!arteFile) {
      setFeedback('⚠️ Selecione a imagem do anúncio (JPG, PNG ou WEBP) antes de reservar.')
      return
    }
    setFeedback(null)
    setReservando(vaga)
    try {
      await publicarAnuncioHome(vaga, periodo, arteFile)
      setFeedback(`✅ Anúncio publicado na ${vaga === 'vaga_1' ? 'VAGA 1' : 'VAGA 2'}.`)
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current)
        previewRevokeRef.current = null
      }
      setArteFile(null)
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      setFeedback('❌ Não foi possível enviar o anúncio. Verifique o formato da imagem e tente de novo.')
    } finally {
      setReservando(null)
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
        <h3 className="mb-2 font-bold text-[#001f3f]">🏠 Espaços Disponíveis na Home</h3>
        <p className="mb-4 text-sm text-gray-500">Máximo 2 anúncios simultâneos</p>

        <div className="mb-6 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-sm font-medium text-[#001f3f]">Arte do anúncio</p>
          <p className="mb-3 text-xs text-gray-500">Formatos: JPG, PNG ou WEBP. Dimensão sugerida: 1200×600 px.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={onArteChange}
            className="block w-full max-w-md text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#0097b2] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          {previewUrl ? (
            <div className="relative mt-4 aspect-[2/1] w-full max-w-md overflow-hidden rounded-lg border bg-white">
              <Image src={previewUrl} alt="Pré-visualização do anúncio" fill className="object-contain" unoptimized />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(['vaga_1', 'vaga_2'] as const).map((vaga) => {
            const disponivel = vagasHomeDisponiveis.some((v) => v.vaga === vaga)
            return (
              <div key={vaga} className={`rounded-lg border p-4 ${disponivel ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">📺 {vaga === 'vaga_1' ? 'VAGA 1' : 'VAGA 2'}</p>
                    <p className={`mt-1 text-sm ${disponivel ? 'text-green-700' : 'text-red-700'}`}>
                      {disponivel ? '✅ Disponível' : '🔴 Ocupada'}
                    </p>
                  </div>

                  {disponivel ? (
                    <div className="text-right">
                      <select
                        value={periodo}
                        onChange={(e) => setPeriodo(e.target.value as PeriodoReserva)}
                        className="mb-2 rounded border p-1 text-sm"
                      >
                        <option value="7d">7 dias</option>
                        <option value="15d">15 dias</option>
                        <option value="30d">30 dias</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleReservar(vaga)}
                        disabled={reservando === vaga}
                        className="block w-full rounded-lg bg-[#0097b2] px-3 py-1 text-sm text-white disabled:opacity-50"
                      >
                        {reservando === vaga ? 'Enviando...' : 'RESERVAR'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {reservas.length > 0 ? (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-4 font-bold text-[#001f3f]">⏳ Reservas Antecipadas</h3>
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
