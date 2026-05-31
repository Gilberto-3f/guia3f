'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageIcon, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  obterUrlChatImagemEmCache,
  resolverUrlAnexoMensagemCanal,
  resolverUrlChatImagemCanal,
  urlPublicaAnexoMensagemCanal,
} from '@/lib/canalAnexoUrl'

/**
 * Imagem de mensagem de canal — miniatura no chat; toque abre visualizador em tela cheia (fundo preto).
 * @param {{ src: string; className?: string; priority?: boolean }} props
 */
export default function CanalMensagemImagem({ src, className = '', priority = false }) {
  const urlPublica = useMemo(() => urlPublicaAnexoMensagemCanal(supabase, src), [src])
  const [srcAtivo, setSrcAtivo] = useState(/** @type {string | null} */ (null))
  const [urlOverlay, setUrlOverlay] = useState(urlPublica)
  const [carregada, setCarregada] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [montado, setMontado] = useState(false)
  const tentouFallbackRef = useRef(false)

  useEffect(() => {
    setMontado(true)
  }, [])

  useEffect(() => {
    let vivo = true
    tentouFallbackRef.current = false
    setCarregada(false)
    setFalhou(false)
    setUrlOverlay(urlPublica)

    const emCache = obterUrlChatImagemEmCache(src)
    if (emCache) {
      setSrcAtivo(emCache)
    } else {
      setSrcAtivo(null)
      void (async () => {
        const resolvida = await resolverUrlChatImagemCanal(supabase, src)
        if (!vivo) return
        setSrcAtivo(resolvida)
      })()
    }

    return () => {
      vivo = false
    }
  }, [src, urlPublica])

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
    if (tentouFallbackRef.current) {
      setFalhou(true)
      setCarregada(false)
      return
    }
    tentouFallbackRef.current = true
    setCarregada(false)
    void resolverUrlAnexoMensagemCanal(supabase, src, { forceSigned: true }).then((signed) => {
      if (signed && signed !== srcAtivo) {
        setSrcAtivo(signed)
        setFalhou(false)
      } else {
        setFalhou(true)
      }
    })
  }, [src, srcAtivo])

  const onErrorOverlay = useCallback(() => {
    void resolverUrlAnexoMensagemCanal(supabase, src, { forceSigned: true }).then((signed) => {
      if (signed) setUrlOverlay(signed)
    })
  }, [src])

  const abrirOverlay = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setUrlOverlay(srcAtivo || urlPublica)
      setAberto(true)
      if (urlPublica && urlPublica !== srcAtivo) {
        const img = new window.Image()
        img.onload = () => setUrlOverlay(urlPublica)
        img.src = urlPublica
      }
    },
    [srcAtivo, urlPublica],
  )

  const pararPropagacao = useCallback((e) => {
    e.stopPropagation()
  }, [])

  const previewClass = `max-h-64 w-full max-w-[min(100%,280px)] rounded-lg object-contain ${className}`
  const skeletonClass = `flex max-h-64 min-h-[7rem] w-full max-w-[min(100%,280px)] items-center justify-center rounded-lg bg-gray-200/90 ${className}`

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
        className="relative inline-block cursor-pointer border-0 bg-transparent p-0 text-left touch-manipulation"
        aria-label="Abrir imagem em tela cheia"
        disabled={falhou && !srcAtivo}
      >
        {!carregada && !falhou ? (
          <div className={skeletonClass} aria-hidden>
            <div className="flex flex-col items-center gap-1.5 text-gray-500">
              <span className="h-8 w-8 animate-pulse rounded-full bg-gray-300/80" />
              <span className="text-[10px] font-medium">A carregar foto…</span>
            </div>
          </div>
        ) : null}

        {falhou ? (
          <div
            className={`${skeletonClass} text-center text-xs text-gray-500`}
            role="status"
          >
            <ImageIcon className="mx-auto mb-1 h-6 w-6 opacity-60" aria-hidden />
            Não foi possível carregar a foto
          </div>
        ) : null}

        {srcAtivo && !falhou ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={srcAtivo}
            src={srcAtivo}
            alt=""
            className={`${previewClass} ${carregada ? 'opacity-100' : 'absolute h-0 w-0 opacity-0'}`}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            onLoad={() => setCarregada(true)}
            onError={onErrorChat}
          />
        ) : null}
      </button>
      {overlay}
    </>
  )
}
