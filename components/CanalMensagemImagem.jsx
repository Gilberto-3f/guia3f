'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolverUrlAnexoMensagemCanal } from '@/lib/canalAnexoUrl'

/**
 * Imagem de mensagem de canal — resolve URL do Storage e fallback assinado se falhar o carregamento.
 * @param {{ src: string; className?: string }} props
 */
export default function CanalMensagemImagem({ src, className = '' }) {
  const [url, setUrl] = useState(src)
  const [tentouAssinada, setTentouAssinada] = useState(false)

  useEffect(() => {
    let cancelled = false
    setTentouAssinada(false)
    setUrl(src)

    void (async () => {
      const resolved = await resolverUrlAnexoMensagemCanal(supabase, src)
      if (!cancelled) setUrl(resolved)
    })()

    return () => {
      cancelled = true
    }
  }, [src])

  const onError = useCallback(() => {
    if (tentouAssinada) return
    setTentouAssinada(true)
    void (async () => {
      const signed = await resolverUrlAnexoMensagemCanal(supabase, src, { forceSigned: true })
      setUrl(signed)
    })()
  }, [src, tentouAssinada])

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Imagem enviada no canal"
        className={`max-h-64 w-full max-w-[min(100%,280px)] cursor-pointer rounded-lg object-contain ${className}`}
        loading="lazy"
        decoding="async"
        onError={onError}
      />
    </a>
  )
}
