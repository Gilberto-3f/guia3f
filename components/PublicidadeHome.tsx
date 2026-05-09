'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

type AnuncioSlide = {
  id: string
  imagem_url: string
  link_url: string | null
}

function isSupabasePublicStorageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) return false
    const host = new URL(base).hostname
    return u.hostname === host && u.pathname.includes('/storage/v1/object/public/')
  } catch {
    return false
  }
}

function BlocoImagemBanner({
  anuncio,
  alt,
  classNameHeight,
}: {
  anuncio: AnuncioSlide
  alt: string
  classNameHeight: string
}) {
  const imagem = anuncio.imagem_url ?? ''
  const usarNextImage = imagem && isSupabasePublicStorageUrl(imagem)

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg bg-gray-200 ${classNameHeight}`}
    >
      {imagem ? (
        usarNextImage ? (
          <Image
            key={anuncio.id}
            src={imagem}
            alt={alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- URLs arbitrárias fora do remotePatterns
          <img
            key={anuncio.id}
            src={imagem}
            alt={alt}
            className="h-full w-full object-cover"
          />
        )
      ) : null}
    </div>
  )
}

function linkEhRotaInterna(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

function envolveLink(anuncio: AnuncioSlide, children: ReactNode): ReactNode {
  const raw = anuncio.link_url
  if (!raw) {
    return <div className="block overflow-hidden rounded-lg">{children}</div>
  }
  const url = raw.trim()
  if (linkEhRotaInterna(url)) {
    return (
      <Link href={url} className="block overflow-hidden rounded-lg">
        {children}
      </Link>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg"
    >
      {children}
    </a>
  )
}

export default function PublicidadeHome() {
  const t = useTranslations('Home')
  const [anuncios, setAnuncios] = useState<AnuncioSlide[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      const hoje = isoDate(new Date())
      const { data, error } = await supabase
        .from('anuncios')
        .select('id, imagem_url, link_url')
        .eq('tipo', 'home')
        .eq('status', 'ativo')
        .lte('periodo_inicio', hoje)
        .gte('periodo_fim', hoje)
        .order('created_at', { ascending: true })

      if (!ativo) return
      if (error) {
        console.error(error)
        setAnuncios([])
      } else {
        setAnuncios(
          (data ?? []).map((row) => ({
            id: String(row.id),
            imagem_url: String(row.imagem_url ?? ''),
            link_url: row.link_url != null ? String(row.link_url) : null,
          }))
        )
      }
      setCarregando(false)
    }
    void carregar()
    return () => {
      ativo = false
    }
  }, [])

  if (carregando) {
    return (
      <div className="shrink-0 px-4 py-2 text-center text-sm text-gray-400">
        {t('loading')}
      </div>
    )
  }

  const primeiro = anuncios[0]
  const alt = t('adImageAlt')
  const blocoH = 'min-h-[176px] h-44 sm:h-52'

  return (
    <div className="shrink-0 px-4 pb-3">
      <div className="w-full">
        {primeiro ? (
          envolveLink(
            primeiro,
            <BlocoImagemBanner anuncio={primeiro} alt={alt} classNameHeight={blocoH} />
          )
        ) : (
          <div
            className={`flex ${blocoH} w-full flex-col items-center justify-center rounded-lg bg-gray-100 px-4 text-center`}
          >
            <p className="font-medium text-gray-400">{t('adSpace')}</p>
            <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
              {t('adHere')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
