'use client'

import { useCallback, useEffect, useState } from 'react'
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

export default function CarrosselPublicidadeHome() {
  const t = useTranslations('Home')
  const [anuncios, setAnuncios] = useState<AnuncioSlide[]>([])
  const [indiceAtual, setIndiceAtual] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [pausado, setPausado] = useState(false)

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
    if (n <= 1 || pausado) return
    const id = window.setInterval(() => {
      setIndiceAtual((prev) => (prev + 1) % n)
    }, AUTO_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [n, pausado])

  useEffect(() => {
    if (n > 0 && indiceAtual >= n) setIndiceAtual(0)
  }, [indiceAtual, n])

  const anterior = useCallback(() => {
    setIndiceAtual((prev) => (prev === 0 ? n - 1 : prev - 1))
  }, [n])

  const proximo = useCallback(() => {
    setIndiceAtual((prev) => (prev === n - 1 ? 0 : prev + 1))
  }, [n])

  const atual = anuncios[indiceAtual]

  if (carregando) {
    return (
      <div className="shrink-0 px-4 py-3 text-center text-sm text-gray-400">
        {t('loading')}
      </div>
    )
  }

  if (n === 0) {
    return (
      <div className="shrink-0 px-4 py-4">
        <div className="rounded-lg bg-gray-100 p-4 text-center sm:p-6">
          <p className="font-medium text-gray-400">{t('adSpace')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('adHere')}</p>
        </div>
      </div>
    )
  }

  const imagem = atual?.imagem_url ?? ''
  const usarNextImage = imagem && isSupabasePublicStorageUrl(imagem)

  const blocoImagem = (
    <div className="relative h-28 w-full overflow-hidden rounded-lg bg-gray-200 sm:h-32">
      {imagem ? (
        usarNextImage ? (
          <Image
            key={atual.id}
            src={imagem}
            alt={t('adImageAlt')}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- URLs arbitrárias fora do remotePatterns
          <img
            key={atual.id}
            src={imagem}
            alt={t('adImageAlt')}
            className="h-full w-full object-cover"
          />
        )
      ) : null}
    </div>
  )

  return (
    <div
      className="relative shrink-0 px-4 py-2"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="relative">
        <div className="relative">
          {n > 1 ? (
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
                <ChevronRight className="h-5 w-5 text-gray-700" aria-hidden />
              </button>
            </>
          ) : null}

          {atual?.link_url ? (
            <a
              href={atual.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg"
            >
              {blocoImagem}
            </a>
          ) : (
            <div className="block overflow-hidden rounded-lg">{blocoImagem}</div>
          )}
        </div>

        {n > 1 ? (
          <div className="mt-2 flex justify-center gap-1.5" role="tablist" aria-label={t('carouselDotsLabel')}>
            {anuncios.map((a, idx) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                onClick={() => setIndiceAtual(idx)}
                aria-selected={idx === indiceAtual}
                aria-label={t('carouselDot', { n: idx + 1 })}
                className={`h-1.5 rounded-full transition-all ${
                  idx === indiceAtual ? 'w-3 bg-[#0097b2]' : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
