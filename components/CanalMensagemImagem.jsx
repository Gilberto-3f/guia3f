'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  resolverUrlAnexoMensagemCanal,
  urlPreviewImagemAnexoMensagemCanal,
  urlPublicaAnexoMensagemCanal,
} from '@/lib/canalAnexoUrl'

const PREVIEW_W = 280
const PREVIEW_H = 256

function urlUsaNextImage(url) {
  return (
    url.startsWith('https://') &&
    (url.includes('/storage/v1/object/public/') || url.includes('/storage/v1/render/image/public/'))
  )
}

/**
 * Imagem de mensagem de canal — preview no chat; toque abre visualizador em tela cheia (fundo preto).
 * @param {{ src: string; className?: string; priority?: boolean }} props
 */
export default function CanalMensagemImagem({ src, className = '', priority = false }) {
  const urlPublica = useMemo(() => urlPublicaAnexoMensagemCanal(supabase, src), [src])
  const urlPreview = useMemo(() => urlPreviewImagemAnexoMensagemCanal(supabase, src), [src])
  const [url, setUrl] = useState(urlPreview)
  const [tentouAssinada, setTentouAssinada] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [montado, setMontado] = useState(false)
  const otimizada = urlUsaNextImage(url)

  useEffect(() => {
    setMontado(true)
  }, [])

  useEffect(() => {
    setUrl(urlPreview)
    setTentouAssinada(false)
  }, [urlPreview])

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
    if (url !== urlPublica && url !== urlPreview) {
      setUrl(urlPublica)
      return
    }
    if (url === urlPreview && urlPreview !== urlPublica) {
      setUrl(urlPublica)
      return
    }
    if (tentouAssinada) return
    setTentouAssinada(true)
    void (async () => {
      const signed = await resolverUrlAnexoMensagemCanal(supabase, src, { forceSigned: true })
      setUrl(signed)
    })()
  }, [src, tentouAssinada, url, urlPreview, urlPublica])

  const previewClass = `max-h-64 w-full max-w-[min(100%,280px)] rounded-lg object-contain ${className}`

  const previewImg = otimizada ? (
    <Image
      src={url}
      alt=""
      width={PREVIEW_W}
      height={PREVIEW_H}
      className={previewClass}
      sizes="(max-width: 360px) 280px, 50vw"
      priority={priority}
      onError={onError}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={previewClass}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={onError}
    />
  )

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
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-colors hover:text-gray-100"
              aria-label="Fechar imagem"
            >
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
            {otimizada ? (
              <div className="relative h-[100dvh] w-[100vw]" onClick={(e) => e.stopPropagation()}>
                <Image src={urlPublica} alt="" fill className="object-contain" sizes="100vw" priority />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlPublica}
                alt=""
                className="max-h-[100dvh] max-w-[100vw] object-contain"
                decoding="async"
                fetchPriority="high"
                onClick={(e) => e.stopPropagation()}
                onError={onError}
              />
            )}
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
        {previewImg}
      </button>
      {overlay}
    </>
  )
}
