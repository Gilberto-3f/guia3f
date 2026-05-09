'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { usePublicidade } from '../../hooks/usePublicidade'

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

export default function Publicidade() {
  const { dados: empresa } = useDashboardEmpresa()
  const { anuncios, loading, error, salvarAnuncioHomeArte } = usePublicidade(empresa?.id ?? null)

  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [arteFile, setArteFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRevokeRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
      setFeedback('⚠️ Selecione a imagem do anúncio (JPG, PNG ou WEBP).')
      return
    }
    setFeedback(null)
    setSalvando(true)
    try {
      await salvarAnuncioHomeArte(arteFile)
      setFeedback('✅ Anúncio salvo e publicado na Home do Guia.')
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current)
        previewRevokeRef.current = null
      }
      setArteFile(null)
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      setFeedback('❌ Não foi possível salvar. Verifique a imagem e tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-900">Carregando...</div>

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-800">
        Erro ao carregar publicidade: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {feedback ? <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-900">{feedback}</div> : null}

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-gray-900">📢 Seus anúncios</h3>
        {anuncios.length === 0 ? (
          <p className="py-4 text-center text-gray-900">Nenhum anúncio cadastrado</p>
        ) : (
          <div className="space-y-3">
            {anuncios.map((anuncio) => (
              <div key={anuncio.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{anuncio.tipo === 'home' ? 'Home (Guia)' : 'Feed'}</p>
                    <p className="text-sm text-gray-900">
                      {formatDate(anuncio.periodo_inicio)} — {formatDate(anuncio.periodo_fim)}
                    </p>
                    {anuncio.link_url ? (
                      <p className="mt-1 truncate text-xs text-gray-900">{anuncio.link_url}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-sm text-gray-900">
                    <p>👁️ {anuncio.impressoes_exibidas.toLocaleString()} impressões</p>
                    <p>🖱️ {anuncio.cliques} cliques</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-gray-900">🏠 Anúncio na Home do Guia</h3>

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
      </div>
    </div>
  )
}
