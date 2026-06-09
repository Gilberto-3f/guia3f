'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'
import { isPdfUrl } from './PreviewDocumento'

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
  useModalScrollLock(aberto)

  const [urlExibir, setUrlExibir] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!doc?.url) {
      setUrlExibir(null)
      setCarregando(false)
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

  if (!aberto || !doc || typeof document === 'undefined') return null

  const href = urlExibir ?? doc.url
  const pdf = isPdfUrl(doc.url)

  const conteudo = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={doc.label}
      onClick={fechar}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          fechar()
        }}
        className="absolute right-3 top-3 z-20 rounded-full bg-black/60 p-2 text-red-500 shadow-lg transition hover:bg-black/80 hover:text-red-400 active:scale-95 sm:right-5 sm:top-5"
        aria-label="Fechar visualização"
      >
        <X className="h-7 w-7" strokeWidth={2.5} aria-hidden />
      </button>

      <p className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-4rem)] truncate text-sm font-semibold text-white/90 sm:left-5 sm:top-5">
        {doc.label}
      </p>

      <div
        className="flex h-full w-full items-center justify-center p-4 pt-14 sm:p-6 sm:pt-16"
        onClick={(e) => e.stopPropagation()}
      >
        {carregando ? (
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white"
            role="status"
            aria-label="Carregando documento"
          />
        ) : pdf ? (
          <iframe
            src={href}
            title={doc.label}
            className="h-[calc(100dvh-5rem)] w-full max-w-5xl rounded-lg border border-white/20 bg-white"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- documento do storage (URL assinada dinâmica)
          <img
            src={href}
            alt={doc.label}
            className="max-h-[calc(100dvh-5rem)] max-w-[calc(100vw-2rem)] object-contain"
            loading="eager"
            decoding="async"
            draggable={false}
            onError={() => {
              if (href !== doc.url) return
              void resolverUrlsDocumentosStorageAdmin([doc.url]).then((map) => {
                const retry = map.get(doc.url)
                if (retry && retry !== href) setUrlExibir(retry)
              })
            }}
          />
        )}
      </div>
    </div>
  )

  return createPortal(conteudo, document.body)
}
