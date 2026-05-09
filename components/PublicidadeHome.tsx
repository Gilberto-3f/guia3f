'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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

const SWIPE_MIN_PX = 48

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
    <div className={`relative h-full w-full overflow-hidden rounded-lg bg-gray-200 ${classNameHeight}`}>
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
    return <div className="block h-full w-full overflow-hidden rounded-lg">{children}</div>
  }
  const url = raw.trim()
  if (linkEhRotaInterna(url)) {
    return (
      <Link href={url} className="block h-full w-full overflow-hidden rounded-lg">
        {children}
      </Link>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full w-full overflow-hidden rounded-lg"
    >
      {children}
    </a>
  )
}

export default function PublicidadeHome() {
  const t = useTranslations('Home')
  const [anuncios, setAnuncios] = useState<AnuncioSlide[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indice, setIndice] = useState(0)
  const touchStartX = useRef<number | null>(null)

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

  const n = anuncios.length

  useEffect(() => {
    if (n === 0) {
      setIndice(0)
      return
    }
    setIndice((prev) => (prev >= n ? n - 1 : prev))
  }, [n])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0]?.clientX ?? null
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartX.current
      touchStartX.current = null
      if (start == null || n <= 1) return
      const end = e.changedTouches[0]?.clientX
      if (end == null) return
      const dx = end - start
      if (dx < -SWIPE_MIN_PX) setIndice((i) => Math.min(n - 1, i + 1))
      else if (dx > SWIPE_MIN_PX) setIndice((i) => Math.max(0, i - 1))
    },
    [n]
  )

  if (carregando) {
    return (
      <div className="shrink-0 px-4 py-2 text-center text-sm text-gray-400">
        {t('loading')}
      </div>
    )
  }

  const alt = t('adImageAlt')
  const blocoH = 'min-h-[176px] h-44 sm:h-52'

  return (
    <div className="shrink-0 px-4 pb-3">
      <div className="w-full">
        {n > 0 ? (
          <div className="w-full">
            <div
              className="relative w-full overflow-hidden rounded-lg"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${indice * 100}%)` }}
              >
                {anuncios.map((anuncio) => (
                  <div key={anuncio.id} className="w-full shrink-0">
                    {envolveLink(
                      anuncio,
                      <BlocoImagemBanner anuncio={anuncio} alt={alt} classNameHeight={blocoH} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {n > 1 ? (
              <div className="mt-2 flex justify-center gap-1.5" role="tablist" aria-label={t('carouselDotsLabel')}>
                {anuncios.map((a, idx) => (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === indice}
                    aria-label={t('carouselDot', { n: idx + 1 })}
                    onClick={() => setIndice(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === indice ? 'w-3 bg-[#0097b2]' : 'w-1.5 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
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
