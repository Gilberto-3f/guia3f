'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'
import { isPdfUrl } from './PreviewDocumento'

export type DocPagina = {
  label: string
  url: string
}

export type DocAmpliado = {
  titulo: string
  paginas: DocPagina[]
}

export function ModalDocumentoAmpliado({
  doc,
  onClose,
  urlsResolvidas,
}: {
  doc: DocAmpliado | null
  onClose: () => void
  /** URLs já resolvidas pelo card (evita flash). */
  urlsResolvidas?: Map<string, string>
}) {
  const aberto = Boolean(doc?.paginas?.length)
  useModalScrollLock(aberto)

  const [urlsExibir, setUrlsExibir] = useState<Map<string, string>>(new Map())
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!doc?.paginas?.length) {
      setUrlsExibir(new Map())
      setCarregando(false)
      return
    }

    const brutas = doc.paginas.map((p) => p.url).filter(Boolean)
    const todasResolvidas = brutas.every((u) => urlsResolvidas?.has(u))
    if (todasResolvidas && urlsResolvidas) {
      const map = new Map<string, string>()
      for (const u of brutas) map.set(u, urlsResolvidas.get(u) ?? u)
      setUrlsExibir(map)
      setCarregando(false)
      return
    }

    let ativo = true
    setCarregando(true)
    setUrlsExibir(new Map())
    void resolverUrlsDocumentosStorageAdmin(brutas).then((map) => {
      if (!ativo) return
      setUrlsExibir(map)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [doc, urlsResolvidas])

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

  const conteudo = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={doc.titulo}
    >
      <div className="relative flex shrink-0 items-center justify-center border-b border-white/10 px-14 py-3">
        <p className="truncate text-center text-sm font-semibold text-white sm:text-base">{doc.titulo}</p>
        <button
          type="button"
          onClick={fechar}
          className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-lg transition hover:bg-white/25 active:scale-95 sm:right-4"
          aria-label="Fechar visualização"
        >
          <X className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {carregando ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white"
              role="status"
              aria-label="Carregando documento"
            />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            {doc.paginas.map((pagina) => {
              const href = urlsExibir.get(pagina.url) ?? pagina.url
              const pdf = isPdfUrl(pagina.url)
              return (
                <div key={pagina.url} className="flex flex-col items-center gap-2">
                  {doc.paginas.length > 1 ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{pagina.label}</p>
                  ) : null}
                  {pdf ? (
                    <iframe
                      src={href}
                      title={pagina.label}
                      className="h-[min(80dvh,56rem)] w-full rounded-lg border border-white/20 bg-white"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- documento do storage (URL assinada dinâmica)
                    <img
                      src={href}
                      alt={pagina.label}
                      className="w-full max-w-full object-contain"
                      loading="eager"
                      decoding="async"
                      draggable={false}
                      onError={() => {
                        if (href !== pagina.url) return
                        void resolverUrlsDocumentosStorageAdmin([pagina.url]).then((map) => {
                          const retry = map.get(pagina.url)
                          if (retry && retry !== href) {
                            setUrlsExibir((prev) => new Map(prev).set(pagina.url, retry))
                          }
                        })
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(conteudo, document.body)
}
