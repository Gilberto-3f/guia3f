'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

type AnuncioSlide = {
  id: string
  imagem_url: string
  link_url: string | null
}

const AUTO_INTERVAL_MS = 5000

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

function envolveLink(anuncio: AnuncioSlide, children: ReactNode): ReactNode {
  if (anuncio.link_url) {
    return (
      <a
        href={anuncio.link_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-lg"
      >
        {children}
      </a>
    )
  }
  return <div className="block overflow-hidden rounded-lg">{children}</div>
}

export default function PublicidadeHome() {
  const t = useTranslations('Home')
  const [anuncios, setAnuncios] = useState<AnuncioSlide[]>([])
  const [indiceCarrossel, setIndiceCarrossel] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [pausadoCarrossel, setPausadoCarrossel] = useState(false)

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

  const primeiro = anuncios[0]
  const restantes = anuncios.slice(1)
  const nRest = restantes.length

  useEffect(() => {
    if (nRest <= 1 || pausadoCarrossel) return
    const id = window.setInterval(() => {
      setIndiceCarrossel((prev) => (prev + 1) % nRest)
    }, AUTO_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [nRest, pausadoCarrossel])

  useEffect(() => {
    if (nRest > 0 && indiceCarrossel >= nRest) setIndiceCarrossel(0)
  }, [indiceCarrossel, nRest])

  const anterior = useCallback(() => {
    setIndiceCarrossel((prev) => (prev === 0 ? nRest - 1 : prev - 1))
  }, [nRest])

  const proximo = useCallback(() => {
    setIndiceCarrossel((prev) => (prev === nRest - 1 ? 0 : prev + 1))
  }, [nRest])

  const atualCarrossel = restantes[indiceCarrossel]

  if (carregando) {
    return (
      <div className="shrink-0 px-4 py-2 text-center text-sm text-gray-400">
        {t('loading')}
      </div>
    )
  }

  const alt = t('adImageAlt')
  const fixoH = 'h-[120px]'

  return (
    <div className="shrink-0 space-y-2 px-4 pb-2">
      <div className="w-full">
        {primeiro ? (
          envolveLink(
            primeiro,
            <BlocoImagemBanner
              anuncio={primeiro}
              alt={alt}
              classNameHeight={fixoH}
            />
          )
        ) : (
          <div
            className={`flex ${fixoH} w-full flex-col items-center justify-center rounded-lg bg-gray-100 px-4 text-center`}
          >
            <p className="font-medium text-gray-400">{t('adSpace')}</p>
            <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
              {t('adHere')}
            </p>
          </div>
        )}
      </div>

      {nRest > 0 ? (
        <div
          className="relative pb-1"
          onMouseEnter={() => setPausadoCarrossel(true)}
          onMouseLeave={() => setPausadoCarrossel(false)}
        >
          <div className="relative">
            <div className="relative">
              {nRest > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={anterior}
                    className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-x-1 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md"
                    aria-label={t('carouselPrev')}
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-700" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={proximo}
                    className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 translate-x-1 items-center justify-center rounded-full bg-white shadow-md"
                    aria-label={t('carouselNext')}
                  >
                    <ChevronRight
                      className="h-5 w-5 text-gray-700"
                      aria-hidden
                    />
                  </button>
                </>
              ) : null}

              {atualCarrossel
                ? envolveLink(
                    atualCarrossel,
                    <BlocoImagemBanner
                      anuncio={atualCarrossel}
                      alt={alt}
                      classNameHeight="h-24 sm:h-28"
                    />
                  )
                : null}
            </div>

            {nRest > 1 ? (
              <div
                className="mt-2 flex justify-center gap-1.5"
                role="tablist"
                aria-label={t('carouselDotsLabel')}
              >
                {restantes.map((a, idx) => (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    onClick={() => setIndiceCarrossel(idx)}
                    aria-selected={idx === indiceCarrossel}
                    aria-label={t('carouselDot', { n: idx + 1 })}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === indiceCarrossel
                        ? 'w-3 bg-[#0097b2]'
                        : 'w-1.5 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
