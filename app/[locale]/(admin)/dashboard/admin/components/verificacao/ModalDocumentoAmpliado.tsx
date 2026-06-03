'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'
import { isPdfUrl, PreviewDocumento } from './PreviewDocumento'
import { useBodyScrollLock } from './useBodyScrollLock'

export type DocAmpliado = {
  label: string
  url: string
}

export function ModalDocumentoAmpliado({
  doc,
  onClose,
  resolvedUrl,
}: {
  doc: DocAmpliado | null
  onClose: () => void
  /** URL já resolvida pelo card (evita flash). */
  resolvedUrl?: string | null
}) {
  const aberto = Boolean(doc?.url)
  useBodyScrollLock(aberto)

  const [urlExibir, setUrlExibir] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!doc?.url) {
      setUrlExibir(null)
      return
    }
    if (resolvedUrl) {
      setUrlExibir(resolvedUrl)
      setCarregando(false)
      return
    }
    let ativo = true
    setCarregando(true)
    setUrlExibir(null)
    void resolverUrlsDocumentosStorageAdmin([doc.url]).then((map) => {
      if (!ativo) return
      setUrlExibir(map.get(doc.url) ?? doc.url)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [doc?.url, resolvedUrl])

  const fechar = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, fechar])

  if (!aberto || !doc) return null

  const href = urlExibir ?? doc.url
  const pdf = isPdfUrl(doc.url)

  const conteudo = (
    <div
      className="fixed inset-0 z-[250] flex flex-col bg-black/85 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={doc.label}
      onClick={fechar}
    >
      <div
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{doc.label}</p>
            <p className="text-xs text-white/70">Clique fora ou pressione Esc para fechar</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25"
            >
              Abrir em nova aba
            </a>
            <button
              type="button"
              onClick={fechar}
              className="rounded-lg bg-white/15 p-2 text-white hover:bg-white/25"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/40">
          {carregando ? (
            <div className="h-48 w-full max-w-lg animate-pulse rounded-lg bg-white/10" aria-hidden />
          ) : pdf ? (
            <iframe
              src={href}
              title={doc.label}
              className="h-full min-h-[60vh] w-full rounded-lg border border-white/20 bg-white"
            />
          ) : (
            <PreviewDocumento
              url={doc.url}
              label={doc.label}
              className="max-h-[75vh] max-w-full object-contain"
              objectFit="contain"
              resolvedUrl={urlExibir ?? resolvedUrl}
            />
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return conteudo
  return createPortal(conteudo, document.body)
}
