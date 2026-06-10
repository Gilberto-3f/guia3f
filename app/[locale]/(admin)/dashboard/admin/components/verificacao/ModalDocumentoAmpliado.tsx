'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'
import { useBodyScrollLock } from './useBodyScrollLock'
import { isPdfUrl } from './PreviewDocumento'

export type DocPagina = {
  label: string
  url: string
}

export type DocAmpliado = {
  titulo: string
  paginas: DocPagina[]
}

function PaginaDocumento({
  pagina,
  href,
  multiplas,
  onErro,
}: {
  pagina: DocPagina
  href: string
  multiplas: boolean
  onErro: () => void
}) {
  const pdf = isPdfUrl(pagina.url)

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {multiplas ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{pagina.label}</p>
      ) : null}
      {pdf ? (
        <iframe
          src={href}
          title={pagina.label}
          className="h-[min(75dvh,48rem)] w-full max-w-5xl rounded-lg border border-white/20 bg-white"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- documento do storage (URL assinada dinâmica)
        <img
          src={href}
          alt={pagina.label}
          className="max-h-[min(82dvh,56rem)] max-w-[min(100vw-2rem,64rem)] object-contain"
          loading="eager"
          decoding="async"
          draggable={false}
          onError={onErro}
        />
      )}
    </div>
  )
}

export function ModalDocumentoAmpliado({
  doc,
  onClose,
  urlsResolvidas,
}: {
  doc: DocAmpliado | null
  onClose: () => void
  urlsResolvidas?: Map<string, string>
}) {
  const aberto = Boolean(doc?.paginas?.length)
  const [montado, setMontado] = useState(false)
  const [urlsExibir, setUrlsExibir] = useState<Map<string, string>>(new Map())
  const [carregando, setCarregando] = useState(false)
  const [erros, setErros] = useState<Set<string>>(new Set())

  useBodyScrollLock(aberto)

  useEffect(() => {
    setMontado(true)
  }, [])

  useEffect(() => {
    if (!doc?.paginas?.length) {
      setUrlsExibir(new Map())
      setCarregando(false)
      setErros(new Set())
      return
    }

    setErros(new Set())
    const brutas = doc.paginas.map((p) => p.url).filter(Boolean)
    const todasResolvidas = brutas.length > 0 && brutas.every((u) => urlsResolvidas?.has(u))
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

  const marcarErro = useCallback((urlBruta: string, hrefAtual: string) => {
    setErros((prev) => new Set(prev).add(urlBruta))
    if (hrefAtual === urlBruta) {
      void resolverUrlsDocumentosStorageAdmin([urlBruta]).then((map) => {
        const retry = map.get(urlBruta)
        if (retry && retry !== urlBruta) {
          setUrlsExibir((prev) => new Map(prev).set(urlBruta, retry))
          setErros((prev) => {
            const next = new Set(prev)
            next.delete(urlBruta)
            return next
          })
        }
      })
    }
  }, [])

  if (!aberto || !doc || !montado || typeof document === 'undefined') return null

  const multiplas = doc.paginas.length > 1

  const conteudo = (
    <div
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-full flex-col overscroll-none bg-black"
      style={{ height: '100dvh' }}
      role="dialog"
      aria-modal="true"
      aria-label={doc.titulo}
    >
      <div className="relative z-10 flex shrink-0 items-center justify-center border-b border-white/10 px-14 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="truncate text-center text-sm font-semibold text-white sm:text-base">{doc.titulo}</p>
        <button
          type="button"
          onClick={fechar}
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white shadow-lg transition hover:bg-white/30 active:scale-95 sm:right-4"
          aria-label="Fechar visualização"
        >
          <X className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {carregando ? (
          <div className="flex min-h-[50dvh] items-center justify-center">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white"
              role="status"
              aria-label="Carregando documento"
            />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
            {doc.paginas.map((pagina) => {
              const href = urlsExibir.get(pagina.url) ?? pagina.url
              const falhou = erros.has(pagina.url)
              return (
                <div key={pagina.url} className="flex w-full flex-col items-center">
                  {falhou ? (
                    <div className="flex min-h-[12rem] w-full max-w-lg flex-col items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-8 text-center">
                      <p className="text-sm text-white/90">Não foi possível exibir este documento aqui.</p>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900"
                      >
                        Abrir em nova aba
                      </a>
                    </div>
                  ) : (
                    <PaginaDocumento
                      pagina={pagina}
                      href={href}
                      multiplas={multiplas}
                      onErro={() => marcarErro(pagina.url, href)}
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
