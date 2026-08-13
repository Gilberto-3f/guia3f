'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { rpcAnon } from '@/lib/rpcAnon'
import { supabase } from '@/lib/supabase'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

type AnuncioSlide = {
  id: string
  imagem_url: string
  link_url: string | null
  empresa_id: string | null
}

const SWIPE_MIN_PX = 48
/** Intervalo de revezamento automático entre criativos ativos. */
const AUTO_ROTACAO_MS = 5000

/** Último anúncio home exibido nesta sessão (próxima visita começa no seguinte). */
const SESSION_LAST_HOME_AD_ID = 'guia_home_ultimo_anuncio_id'

/** Lista em cache (sessionStorage) para evitar espera ao voltar à Home. */
const SESSION_ANUNCIOS_HOME_JSON = 'guia_home_anuncios_cache_v1'

function slidesDesdeCache(raw: string | null): AnuncioSlide[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const out: AnuncioSlide[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      const id = o.id != null ? String(o.id) : ''
      if (!id) continue
      out.push({
        id,
        imagem_url: String(o.imagem_url ?? ''),
        link_url: o.link_url != null ? String(o.link_url) : null,
        empresa_id: o.empresa_id != null ? String(o.empresa_id) : null,
      })
    }
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

function gravarCacheHome(slides: AnuncioSlide[]) {
  try {
    if (slides.length > 0) sessionStorage.setItem(SESSION_ANUNCIOS_HOME_JSON, JSON.stringify(slides))
    else sessionStorage.removeItem(SESSION_ANUNCIOS_HOME_JSON)
  } catch {
    /* ignore */
  }
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
  priorizarCarregamento,
}: {
  anuncio: AnuncioSlide
  alt: string
  classNameHeight: string
  priorizarCarregamento?: boolean
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
            priority={Boolean(priorizarCarregamento)}
            fetchPriority={priorizarCarregamento ? 'high' : 'auto'}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- URLs arbitrárias fora do remotePatterns
          <img
            key={anuncio.id}
            src={imagem}
            alt={alt}
            className="h-full w-full object-cover"
            fetchPriority={priorizarCarregamento ? 'high' : 'auto'}
          />
        )
      ) : null}
    </div>
  )
}

function linkEhRotaInterna(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

/** Ids já contabilizados nesta sessão (evita rajada ao voltar do idle / remount). */
const impressoesRegistradas = new Set<string>()

function SlideEnvoltorio({ anuncio, children }: { anuncio: AnuncioSlide; children: ReactNode }) {
  const hrefResolvido = (() => {
    const raw = anuncio.link_url != null ? String(anuncio.link_url).trim() : ''
    if (raw) return raw
    const empId = anuncio.empresa_id != null ? String(anuncio.empresa_id).trim() : ''
    return empId ? `/empresa/${empId}` : ''
  })()

  const registrarClique = useCallback(() => {
    void rpcAnon('registrar_clique_anuncio_home', { p_anuncio_id: anuncio.id }).then((res) => {
      if (!res.ok) console.warn('[PublicidadeHome] clique:', res.error)
    })
  }, [anuncio.id])

  if (!hrefResolvido) {
    return (
      <button
        type="button"
        className="block h-full w-full overflow-hidden rounded-lg text-left"
        onClick={registrarClique}
      >
        {children}
      </button>
    )
  }
  if (linkEhRotaInterna(hrefResolvido)) {
    return (
      <Link
        href={hrefResolvido}
        className="block h-full w-full overflow-hidden rounded-lg"
        onClick={registrarClique}
      >
        {children}
      </Link>
    )
  }
  return (
    <a
      href={hrefResolvido}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full w-full overflow-hidden rounded-lg"
      onClick={registrarClique}
    >
      {children}
    </a>
  )
}

/** Próximo índice após o último visto (round-robin). Sem last → aleatório se houver vários. */
function indiceInicialRotacao(slides: AnuncioSlide[]): number {
  if (slides.length === 0) return 0
  if (slides.length === 1) return 0
  try {
    const lastId = sessionStorage.getItem(SESSION_LAST_HOME_AD_ID)
    if (!lastId) {
      return Math.floor(Math.random() * slides.length)
    }
    const i = slides.findIndex((s) => s.id === lastId)
    if (i < 0) return Math.floor(Math.random() * slides.length)
    return (i + 1) % slides.length
  } catch {
    return 0
  }
}

export default function PublicidadeHome() {
  const t = useTranslations('Home')
  const [anuncios, setAnuncios] = useState<AnuncioSlide[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indice, setIndice] = useState(0)
  const touchStartX = useRef<number | null>(null)
  /** Evita reaplicar rotação no fetch (bug: avançava 2× e “grudava” no mesmo criativo). */
  const rotacaoAplicadaRef = useRef(false)
  const indiceRef = useRef(0)
  const anunciosRef = useRef<AnuncioSlide[]>([])

  indiceRef.current = indice
  anunciosRef.current = anuncios

  const aplicarSlides = useCallback((slides: AnuncioSlide[]) => {
    if (!rotacaoAplicadaRef.current) {
      const idx = indiceInicialRotacao(slides)
      rotacaoAplicadaRef.current = true
      setAnuncios(slides)
      setIndice(slides.length ? idx : 0)
    } else {
      setAnuncios(slides)
      setIndice((prev) => {
        if (slides.length === 0) return 0
        const idAtual = anunciosRef.current[prev]?.id
        if (idAtual) {
          const j = slides.findIndex((s) => s.id === idAtual)
          if (j >= 0) return j
        }
        return Math.min(prev, slides.length - 1)
      })
    }
  }, [])

  useLayoutEffect(() => {
    try {
      const cached = slidesDesdeCache(sessionStorage.getItem(SESSION_ANUNCIOS_HOME_JSON))
      if (cached && cached.length > 0) {
        aplicarSlides(cached)
        setCarregando(false)
      }
    } catch {
      /* ignore */
    }
  }, [aplicarSlides])

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      const hoje = isoDate(new Date())
      const { data, error } = await supabase
        .from('anuncios')
        .select('id, empresa_id, imagem_url, link_url')
        .eq('tipo', 'home')
        .eq('status', 'ativo')
        .lte('periodo_inicio', hoje)
        .gte('periodo_fim', hoje)
        .order('created_at', { ascending: true })

      if (!ativo) return
      if (error) {
        console.error(error)
        setAnuncios((prev) => (prev.length > 0 ? prev : []))
      } else {
        const slides: AnuncioSlide[] = (data ?? []).map((row) => ({
          id: String(row.id),
          imagem_url: String(row.imagem_url ?? ''),
          link_url: row.link_url != null ? String(row.link_url) : null,
          empresa_id: row.empresa_id != null ? String(row.empresa_id) : null,
        }))
        gravarCacheHome(slides)
        aplicarSlides(slides)
      }
      setCarregando(false)
    }
    void carregar()
    return () => {
      ativo = false
    }
  }, [aplicarSlides])

  /** Grava o último visto só ao sair da home (não a cada troca de índice). */
  useEffect(() => {
    return () => {
      const id = anunciosRef.current[indiceRef.current]?.id
      if (!id) return
      try {
        sessionStorage.setItem(SESSION_LAST_HOME_AD_ID, id)
      } catch {
        /* ignore */
      }
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

  /** Revezamento automático entre criativos ativos. */
  useEffect(() => {
    if (n <= 1) return
    const id = window.setInterval(() => {
      setIndice((i) => (i + 1) % n)
    }, AUTO_ROTACAO_MS)
    return () => window.clearInterval(id)
  }, [n])

  useEffect(() => {
    if (!n) return
    const id = anuncios[indice]?.id
    if (!id) return
    if (impressoesRegistradas.has(id)) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    const t = window.setTimeout(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (impressoesRegistradas.has(id)) return
      impressoesRegistradas.add(id)
      void rpcAnon('registrar_impressao_anuncio_home', { p_anuncio_id: id }).then((res) => {
        if (!res.ok) {
          impressoesRegistradas.delete(id)
          console.warn('[PublicidadeHome] impressão:', res.error)
        }
      })
    }, 1000)
    return () => window.clearTimeout(t)
  }, [anuncios, indice, n])

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
      if (dx < -SWIPE_MIN_PX) setIndice((i) => (i + 1) % n)
      else if (dx > SWIPE_MIN_PX) setIndice((i) => (i - 1 + n) % n)
    },
    [n],
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
    <div className="shrink-0 px-4 pb-2">
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
                {anuncios.map((anuncio, slideIdx) => (
                  <div key={anuncio.id} className="w-full shrink-0">
                    <SlideEnvoltorio anuncio={anuncio}>
                      <BlocoImagemBanner
                        anuncio={anuncio}
                        alt={alt}
                        classNameHeight={blocoH}
                        priorizarCarregamento={slideIdx === indice}
                      />
                    </SlideEnvoltorio>
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
