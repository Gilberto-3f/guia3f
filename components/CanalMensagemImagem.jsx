'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  extrairPathBucketMensagens,
  resolverUrlAnexoMensagemCanal,
  urlPreviewImagemAnexoMensagemCanal,
  urlPublicaAnexoMensagemCanal,
} from '@/lib/canalAnexoUrl'

/**
 * Imagem de mensagem de canal — miniatura no chat; toque abre visualizador em tela cheia (fundo preto).
 * @param {{ src: string; className?: string; priority?: boolean }} props
 */
export default function CanalMensagemImagem({ src, className = '', priority = false }) {
  const urlPublica = useMemo(() => urlPublicaAnexoMensagemCanal(supabase, src), [src])
  const urlPreview = useMemo(() => urlPreviewImagemAnexoMensagemCanal(supabase, src), [src])
  const [urlChat, setUrlChat] = useState(urlPreview)
  const [urlOverlay, setUrlOverlay] = useState(urlPublica)
  const [aberto, setAberto] = useState(false)
  const [montado, setMontado] = useState(false)
  const signedProntoRef = useRef(/** @type {string | null} */ (null))
  const fallbackChatRef = useRef(/** @type {'publica' | 'assinada' | 'done'} */ ('publica'))

  useEffect(() => {
    setMontado(true)
  }, [])

  useEffect(() => {
    setUrlChat(urlPreview)
    setUrlOverlay(urlPublica)
    fallbackChatRef.current = 'publica'
    signedProntoRef.current = null

    const path = extrairPathBucketMensagens(src)
    if (!path) return

    let vivo = true
    void resolverUrlAnexoMensagemCanal(supabase, src, { forceSigned: true }).then((signed) => {
      if (!vivo) return
      signedProntoRef.current = signed
    })
    return () => {
      vivo = false
    }
  }, [src, urlPreview, urlPublica])

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

  const onErrorChat = useCallback(() => {
    if (fallbackChatRef.current === 'publica') {
      fallbackChatRef.current = 'assinada'
      if (urlChat !== urlPublica && urlPublica) {
        setUrlChat(urlPublica)
        return
      }
    }
    if (fallbackChatRef.current === 'assinada') {
      fallbackChatRef.current = 'done'
      const signed = signedProntoRef.current
      if (signed && urlChat !== signed) {
        setUrlChat(signed)
        return
      }
      void resolverUrlAnexoMensagemCanal(supabase, src, { forceSigned: true }).then((s) => {
        if (s) setUrlChat(s)
      })
    }
  }, [src, urlChat, urlPublica])

  const onErrorOverlay = useCallback(() => {
    const signed = signedProntoRef.current
    if (signed && urlOverlay !== signed) {
      setUrlOverlay(signed)
      return
    }
    void resolverUrlAnexoMensagemCanal(supabase, src, { forceSigned: true }).then((s) => {
      if (s) setUrlOverlay(s)
    })
  }, [src, urlOverlay])

  const abrirOverlay = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setUrlOverlay(urlChat || urlPublica)
      setAberto(true)
      if (urlPublica && urlPublica !== urlChat) {
        const img = new window.Image()
        img.onload = () => setUrlOverlay(urlPublica)
        img.src = urlPublica
      }
    },
    [urlChat, urlPublica],
  )

  const pararPropagacao = useCallback((e) => {
    e.stopPropagation()
  }, [])

  const previewClass = `max-h-64 w-full max-w-[min(100%,280px)] rounded-lg object-contain ${className}`

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlOverlay}
              alt=""
              className="max-h-[100dvh] max-w-[100vw] object-contain"
              decoding="async"
              fetchPriority="high"
              onClick={(e) => e.stopPropagation()}
              onError={onErrorOverlay}
            />
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        onClick={abrirOverlay}
        onPointerDown={pararPropagacao}
        onPointerUp={pararPropagacao}
        onPointerCancel={pararPropagacao}
        className="inline-block cursor-pointer border-0 bg-transparent p-0 text-left touch-manipulation"
        aria-label="Abrir imagem em tela cheia"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urlChat}
          alt=""
          className={previewClass}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={onErrorChat}
        />
      </button>
      {overlay}
    </>
  )
}
