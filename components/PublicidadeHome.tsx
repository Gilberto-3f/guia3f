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

const AUTO_INTERVAL_MS = 15000

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
  /** Demais criativos após o primeiro (campo fixo reservado ao 1.º anunciante). */
  const anunciosCarrossel = anuncios.slice(1)
  const nCarrossel = anunciosCarrossel.length

  useEffect(() => {
    if (nCarrossel <= 1 || pausadoCarrossel) return
    const id = window.setInterval(() => {
      setIndiceCarrossel((prev) => (prev + 1) % nCarrossel)
    }, AUTO_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [nCarrossel, pausadoCarrossel])

  useEffect(() => {
    if (nCarrossel > 0 && indiceCarrossel >= nCarrossel)
      setIndiceCarrossel(0)
  }, [indiceCarrossel, nCarrossel])

  const anterior = useCallback(() => {
    setIndiceCarrossel((prev) => (prev === 0 ? nCarrossel - 1 : prev - 1))
  }, [nCarrossel])

  const proximo = useCallback(() => {
    setIndiceCarrossel((prev) =>
      prev === nCarrossel - 1 ? 0 : prev + 1
    )
  }, [nCarrossel])

  const atualCarrossel = anunciosCarrossel[indiceCarrossel]

  if (carregando) {
    return (
      <div className="shrink-0 px-4 py-2 text-center text-sm text-gray-400">
        {t('loading')}
      </div>
    )
  }

  const alt = t('adImageAlt')
  const fixoH = 'h-[120px]'
  const carrosselH = 'h-36 sm:h-40'

  return (
    <div className="shrink-0 space-y-3 px-4 pb-3">
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

      <section className="relative pb-1">
        {nCarrossel === 0 ? (
          <div
            className={`relative flex ${carrosselH} w-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-10 text-center sm:px-12`}
          >
            <button
              type="button"
              disabled
              className="pointer-events-none absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-400 shadow-md sm:left-2"
              aria-hidden
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              disabled
              className="pointer-events-none absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-400 shadow-md sm:right-2"
              aria-hidden
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <p className="relative z-0 max-w-[min(100%,16rem)] text-xs font-medium text-gray-400 sm:text-sm">
              {t('adCarouselEmpty')}
            </p>
          </div>
        ) : (
          <div
            className="relative"
            onMouseEnter={() => setPausadoCarrossel(true)}
            onMouseLeave={() => setPausadoCarrossel(false)}
          >
            <div className="relative px-1 sm:px-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={anterior}
                  disabled={nCarrossel <= 1}
                  className={`absolute left-0 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md sm:left-1 ${
                    nCarrossel <= 1
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:bg-gray-50 active:bg-gray-100'
                  }`}
                  aria-label={t('carouselPrev')}
                  aria-disabled={nCarrossel <= 1}
                >
                  <ChevronLeft className="h-6 w-6 text-gray-800" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={proximo}
                  disabled={nCarrossel <= 1}
                  className={`absolute right-0 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md sm:right-1 ${
                    nCarrossel <= 1
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:bg-gray-50 active:bg-gray-100'
                  }`}
                  aria-label={t('carouselNext')}
                  aria-disabled={nCarrossel <= 1}
                >
                  <ChevronRight className="h-6 w-6 text-gray-800" aria-hidden />
                </button>

                <div className="mx-11 sm:mx-12">
                  {atualCarrossel
                    ? envolveLink(
                        atualCarrossel,
                        <BlocoImagemBanner
                          anuncio={atualCarrossel}
                          alt={alt}
                          classNameHeight={carrosselH}
                        />
                      )
                    : null}
                </div>
              </div>

              {nCarrossel > 1 ? (
                <div
                  className="mt-2 flex justify-center gap-1.5"
                  role="tablist"
                  aria-label={t('carouselDotsLabel')}
                >
                  {anunciosCarrossel.map((a, idx) => (
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
        )}
      </section>
    </div>
  )
}
