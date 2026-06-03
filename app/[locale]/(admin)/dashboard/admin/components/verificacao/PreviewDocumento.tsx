'use client'

import { useEffect, useState } from 'react'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'

export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().includes('.pdf')
}

export function PreviewDocumento({
  url,
  label,
  className,
  objectFit = 'cover',
  resolvedUrl,
}: {
  url: string
  label: string
  className?: string
  objectFit?: 'cover' | 'contain'
  /** URL já resolvida pelo card (evita round-trip duplicado). */
  resolvedUrl?: string | null
}) {
  const [src, setSrc] = useState<string | null>(resolvedUrl ?? null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (resolvedUrl) {
      setSrc(resolvedUrl)
      setErro(false)
      return
    }
    let ativo = true
    setErro(false)
    setSrc(null)
    void resolverUrlsDocumentosStorageAdmin([url]).then((map) => {
      if (ativo) setSrc(map.get(url) ?? url)
    })
    return () => {
      ativo = false
    }
  }, [url, resolvedUrl])

  if (isPdfUrl(url)) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center ${className ?? ''}`}>
        <span className="text-[10px] font-bold text-gray-700">PDF</span>
        <span className="line-clamp-2 text-[10px] text-gray-500">{label}</span>
      </div>
    )
  }

  if (erro) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gray-100 text-[10px] text-gray-500 ${className ?? ''}`}>
        Não foi possível carregar
      </div>
    )
  }

  if (!src) {
    return <div className={`animate-pulse bg-gray-200 ${className ?? ''}`} aria-hidden />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- preview de documentos do storage (URL assinada dinâmica)
    <img
      src={src}
      alt={label}
      className={className}
      style={{ objectFit }}
      loading="eager"
      decoding="async"
      draggable={false}
      onError={() => setErro(true)}
    />
  )
}
