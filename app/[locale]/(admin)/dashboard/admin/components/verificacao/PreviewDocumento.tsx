'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolverUrlDocumentoStorage } from '@/lib/documentosStorageUrl'

export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().includes('.pdf')
}

export function PreviewDocumento({
  url,
  label,
  className,
  objectFit = 'cover',
}: {
  url: string
  label: string
  className?: string
  objectFit?: 'cover' | 'contain'
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    setErro(false)
    setSrc(null)
    void resolverUrlDocumentoStorage(supabase, url).then((resolvida) => {
      if (ativo) setSrc(resolvida)
    })
    return () => {
      ativo = false
    }
  }, [url])

  if (isPdfUrl(url)) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center ${className ?? ''}`}>
        <span className="text-[10px] font-bold text-gray-700">PDF</span>
        <span className="line-clamp-2 text-[10px] text-gray-500">{label}</span>
      </div>
    )
  }

  if (erro || !src) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gray-100 text-[10px] text-gray-500 ${className ?? ''}`}>
        {!src ? 'Carregando…' : 'Não foi possível carregar'}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={label}
      className={className}
      style={{ objectFit }}
      loading="lazy"
      onError={() => setErro(true)}
    />
  )
}
