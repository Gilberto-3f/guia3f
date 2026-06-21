'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  anuncioHomeEmVeiculacao,
  anuncioHomeNoHistorico,
  usePublicidade,
} from '../../hooks/usePublicidade'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import SecaoChevron from './SecaoChevron'

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function formatCtr(impressoes: number, cliques: number): string {
  if (!impressoes || impressoes <= 0) return '—'
  return `${((cliques / impressoes) * 100).toFixed(1)}%`
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function abaCls(ativa: boolean) {
  return `flex-1 border-b-[3px] py-3 text-center text-sm font-semibold transition-colors sm:text-base ${
    ativa ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
  }`
}

export default function Publicidade() {
  const { dados: empresa } = useDashboardEmpresa()
  const { anuncios, loading, error, salvarAnuncioHomeArte, desativarAnuncio } = usePublicidade(
    empresa?.id ?? null
  )

  const [aba, setAba] = useState<'propagandas' | 'historico'>('propagandas')
  const [salvando, setSalvando] = useState(false)
  const [finalizandoId, setFinalizandoId] = useState<string | null>(null)
  const [confirmarFinalizacaoId, setConfirmarFinalizacaoId] = useState<string | null>(null)
  /** Mensagens do formulário novo anúncio (abaixo do botão Salvar). */
  const [msgFormulario, setMsgFormulario] = useState<string | null>(null)
  /** Feedback do botão Finalizar, ligado ao anúncio que disparou a ação. */
  const [msgFinalizar, setMsgFinalizar] = useState<{ anuncioId: string; texto: string } | null>(null)

  const [arteFile, setArteFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [secHome, setSecHome] = useState(true)
  const [secExterna, setSecExterna] = useState(false)
  const previewRevokeRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const emVeiculacao = useMemo(() => {
    const hoje = hojeIso()
    return anuncios.filter((a) => anuncioHomeEmVeiculacao(a, hoje))
  }, [anuncios])
  const anuncioAtivo = emVeiculacao[0] ?? null

  const historicoHome = useMemo(() => {
    const hoje = hojeIso()
    return anuncios.filter((a) => anuncioHomeNoHistorico(a, hoje))
  }, [anuncios])
  const anuncioParaFinalizar = confirmarFinalizacaoId
    ? anuncios.find((anuncio) => anuncio.id === confirmarFinalizacaoId)
    : null

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

  const handleSalvarAnuncio = async () => {
    if (!arteFile) {
      setMsgFormulario('⚠️ Selecione a imagem do anúncio (JPG, PNG ou WEBP).')
      return
    }
    setMsgFormulario(null)
    setSalvando(true)
    try {
      await salvarAnuncioHomeArte(arteFile)
      setMsgFormulario('✅ Anúncio salvo e publicado na Home do Guia.')
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current)
        previewRevokeRef.current = null
      }
      setArteFile(null)
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setMsgFormulario(
        e instanceof Error
          ? `❌ ${e.message}`
          : '❌ Não foi possível salvar. Verifique a imagem e tente de novo.'
      )
    } finally {
      setSalvando(false)
    }
  }

  const handleFinalizar = async (anuncioId: string) => {
    setMsgFinalizar(null)
    setFinalizandoId(anuncioId)
    try {
      await desativarAnuncio(anuncioId)
      setMsgFinalizar({
        anuncioId,
        texto: '✅ Anúncio finalizado e movido para o Histórico. Você pode criar um novo quando quiser.',
      })
      setAba('historico')
    } catch {
      setMsgFinalizar({
        anuncioId,
        texto: '❌ Não foi possível finalizar o anúncio. Tente de novo.',
      })
    } finally {
      setFinalizandoId(null)
      setConfirmarFinalizacaoId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-2" aria-busy="true" aria-label="A carregar publicidade">
        <div className="flex gap-0 border-b border-gray-200 bg-white">
          <div className="h-12 flex-1 animate-pulse bg-gray-100" />
          <div className="h-12 flex-1 animate-pulse bg-gray-50" />
        </div>
        <div className="h-11 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-36 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-28 animate-pulse rounded-lg bg-gray-200" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-800">
        Erro ao carregar publicidade: {error.message}
      </div>
    )
  }

  return (
    <div>
      <div className="-mx-4 flex border-b border-gray-200 bg-white px-0 sm:mx-0">
        <button type="button" className={abaCls(aba === 'propagandas')} onClick={() => setAba('propagandas')}>
          Propagandas
        </button>
        <button type="button" className={abaCls(aba === 'historico')} onClick={() => setAba('historico')}>
          Histórico
        </button>
      </div>

      {aba === 'propagandas' ? (
        <div className="mt-4 space-y-4">
          <SecaoChevron titulo="Propaganda na Home" aberta={secHome} onToggle={() => setSecHome((v) => !v)}>
          {anuncioAtivo ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-gray-50 p-4">
                <h3 className="mb-3 font-bold text-gray-900">Anúncio ativo na Home</h3>
                <p className="mb-4 text-xs text-gray-600">
                  Só é permitido um anúncio em veiculação por vez. Finalize o atual para publicar outro criativo.
                </p>
                  <div className="rounded-lg border border-gray-200 p-4">
                    {anuncioAtivo.imagem_url ? (
                      <div className="relative mx-auto mb-4 aspect-[2/1] w-full max-w-md overflow-hidden rounded-lg bg-gray-100">
                        <Image
                          src={anuncioAtivo.imagem_url}
                          alt="Anúncio na Home"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 448px"
                        />
                      </div>
                    ) : null}
                    <p className="text-sm text-gray-900">
                      <span className="font-medium text-gray-700">Período:</span>{' '}
                      {formatDate(anuncioAtivo.periodo_inicio)} — {formatDate(anuncioAtivo.periodo_fim)}
                    </p>
                    <p className="mt-2 text-sm text-gray-900">
                      <span className="font-medium text-gray-700">Visualizações:</span>{' '}
                      {anuncioAtivo.impressoes_exibidas.toLocaleString('pt-BR')} ·{' '}
                      <span className="font-medium text-gray-700">Cliques:</span>{' '}
                      {anuncioAtivo.cliques.toLocaleString('pt-BR')} ·{' '}
                      <span className="font-medium text-gray-700">CTR:</span>{' '}
                      {formatCtr(anuncioAtivo.impressoes_exibidas, anuncioAtivo.cliques)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmarFinalizacaoId(anuncioAtivo.id)}
                      disabled={finalizandoId === anuncioAtivo.id}
                      className="mt-4 w-full rounded-lg bg-[#0097b2] px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                    >
                      {finalizandoId === anuncioAtivo.id ? 'Finalizando...' : 'Finalizar anúncio'}
                    </button>
                    {msgFinalizar && msgFinalizar.anuncioId === anuncioAtivo.id ? (
                      <p
                        className={`mt-3 text-sm ${
                          msgFinalizar.texto.startsWith('✅')
                            ? 'text-green-800'
                            : msgFinalizar.texto.startsWith('❌')
                              ? 'text-red-700'
                              : 'text-gray-900'
                        }`}
                        role="status"
                      >
                        {msgFinalizar.texto}
                      </p>
                    ) : null}
                  </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-4">
              <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                Nenhum anúncio ativo. Crie um novo.
              </p>
              <h3 className="mb-4 font-bold text-gray-900">🏠 Novo anúncio na Home do Guia</h3>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <label htmlFor="arte-home-guia" className="mb-2 block text-sm font-medium text-gray-900">
                  Arte do anúncio
                </label>
                <p className="mb-3 text-xs text-gray-900">JPG, PNG ou WEBP. Sugestão: 1200×600 px.</p>
                <input
                  id="arte-home-guia"
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={onArteChange}
                  className="block w-full max-w-md rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 file:mr-3 file:rounded-md file:border-0 file:bg-[#0097b2] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                {previewUrl ? (
                  <div className="relative mt-4 aspect-[2/1] w-full max-w-md overflow-hidden rounded-lg border border-gray-300 bg-white">
                    <Image src={previewUrl} alt="Pré-visualização" fill className="object-contain" unoptimized />
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void handleSalvarAnuncio()}
                disabled={salvando}
                className="mt-4 w-full rounded-lg bg-[#0097b2] px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar anúncio'}
              </button>
              {msgFormulario ? (
                <p
                  className={`mt-3 text-sm ${
                    msgFormulario.startsWith('✅')
                      ? 'text-green-800'
                      : msgFormulario.startsWith('❌') || msgFormulario.startsWith('⚠️')
                        ? 'text-red-700'
                        : 'text-gray-900'
                  }`}
                  role="status"
                >
                  {msgFormulario}
                </p>
              ) : null}
            </div>
          )}
          </SecaoChevron>

          <SecaoChevron
            titulo="Publicidade Externa"
            aberta={secExterna}
            onToggle={() => setSecExterna((v) => !v)}
          />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border bg-white p-4">
          <h3 className="mb-2 font-bold text-gray-900">Histórico de campanhas</h3>
          <p className="mb-4 text-xs text-gray-600">
            Anúncios desativados ou fora do período de veiculação (mais recentes primeiro).
          </p>
          {historicoHome.length === 0 ? (
            <p className="py-8 text-center text-gray-900">Nenhuma campanha encerrada ainda.</p>
          ) : (
            <ul className="space-y-4">
              {historicoHome.map((anuncio) => (
                <li
                  key={anuncio.id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-start"
                >
                  {anuncio.imagem_url ? (
                    <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:w-40">
                      <Image
                        src={anuncio.imagem_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[2/1] w-full shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400 sm:w-40">
                      Sem imagem
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-sm text-gray-900">
                    <p className="font-medium text-gray-900">
                      {formatDate(anuncio.periodo_inicio)} — {formatDate(anuncio.periodo_fim)}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {anuncio.status === 'inativo' ? 'Desativado manualmente' : 'Período encerrado'}
                    </p>
                    <p className="mt-2">
                      <span className="font-medium text-gray-700">Visualizações:</span>{' '}
                      {anuncio.impressoes_exibidas.toLocaleString('pt-BR')}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium text-gray-700">Cliques:</span>{' '}
                      {anuncio.cliques.toLocaleString('pt-BR')}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium text-gray-700">CTR:</span>{' '}
                      {formatCtr(anuncio.impressoes_exibidas, anuncio.cliques)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {anuncioParaFinalizar ? (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-finalizar-anuncio"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="confirmar-finalizar-anuncio" className="text-lg font-bold text-gray-900">
              Finalizar anúncio?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              O anúncio deixa de aparecer na Home imediatamente e será movido para a aba Histórico.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmarFinalizacaoId(null)}
                disabled={finalizandoId === anuncioParaFinalizar.id}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleFinalizar(anuncioParaFinalizar.id)}
                disabled={finalizandoId === anuncioParaFinalizar.id || anuncioParaFinalizar.status !== 'ativo'}
                className="flex-1 rounded-lg bg-[#0097b2] px-4 py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50"
              >
                {finalizandoId === anuncioParaFinalizar.id ? 'Finalizando...' : 'Finalizar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
