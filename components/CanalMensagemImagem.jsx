'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolverUrlAnexoMensagemCanal, urlPublicaAnexoMensagemCanal } from '@/lib/canalAnexoUrl'

/**
 * Imagem de mensagem de canal — URL pública imediata; assinada só se o carregamento falhar.
 * @param {{ src: string; className?: string }} props
 */
export default function CanalMensagemImagem({ src, className = '' }) {
  const urlPublica = useMemo(() => urlPublicaAnexoMensagemCanal(supabase, src), [src])
  const [url, setUrl] = useState(urlPublica)
  const [tentouAssinada, setTentouAssinada] = useState(false)

  useEffect(() => {
    setUrl(urlPublica)
    setTentouAssinada(false)
  }, [urlPublica])

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
