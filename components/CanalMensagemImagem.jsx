'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { resolverUrlAnexoMensagemCanal, urlPublicaAnexoMensagemCanal } from '@/lib/canalAnexoUrl'

/**
 * Imagem de mensagem de canal — preview no chat; toque abre visualizador em tela cheia (fundo preto).
 * @param {{ src: string; className?: string }} props
 */
export default function CanalMensagemImagem({ src, className = '' }) {
  const urlPublica = useMemo(() => urlPublicaAnexoMensagemCanal(supabase, src), [src])
  const [url, setUrl] = useState(urlPublica)
  const [tentouAssinada, setTentouAssinada] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    setMontado(true)
  }, [])

  useEffect(() => {
    setUrl(urlPublica)
    setTentouAssinada(false)
  }, [urlPublica])

  const fechar = useCallback(() => setAberto(false), [])

  useEffect(() => {
    if (!aberto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [aberto, fechar])

  const onError = useCallback(() => {
    if (tentouAssinada) return
    setTentouAssinada(true)
    void (async () => {
      const signed = await resolverUrlAnexoMensagemCanal(supabase, src, { forceSigned: true })
      setUrl(signed)
    })()
  }, [src, tentouAssinada])

  const overlay =
    aberto && montado
      ? createPortal(
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black"
            role="dialog"
            aria-modal="true"
            aria-label="Visualização da imagem"
            onClick={fechar}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                fechar()
              }}
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
              aria-label="Fechar imagem"
            >
              <X size={24} aria-hidden />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="max-h-[100dvh] max-w-[100vw] object-contain"
              decoding="async"
              onClick={(e) => e.stopPropagation()}
              onError={onError}
            />
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-block cursor-pointer border-0 bg-transparent p-0 text-left"
        aria-label="Abrir imagem em tela cheia"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className={`max-h-64 w-full max-w-[min(100%,280px)] rounded-lg object-contain ${className}`}
          loading="lazy"
          decoding="async"
          onError={onError}
        />
      </button>
      {overlay}
    </>
  )
}
