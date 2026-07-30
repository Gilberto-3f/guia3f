'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, Crosshair, MapPin, Navigation, Search } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import {
  buildMobilidadePesquisaHref,
  pontoPreenchido,
  type MobilidadePonto,
} from '@/lib/mobilidadePesquisaParams'
import { reverseGeocodeMapbox } from '@/lib/mapboxReverseGeocode'

type Props = {
  destinoInicial?: MobilidadePonto | null
  origemInicial?: MobilidadePonto | null
  /** Inicia expandido (ex.: deep link). */
  expandidoInicial?: boolean
  className?: string
  onOrigemChange?: (ponto: MobilidadePonto) => void
}

/**
 * Card colapsável "Para Onde?" — ponto de partida (GPS + endereço) + destino.
 */
export default function CardParaOndeMobilidade({
  destinoInicial = null,
  origemInicial = null,
  expandidoInicial = false,
  className = '',
  onOrigemChange,
}: Props) {
  const t = useTranslations('Mobilidade')
  const router = useRouter()

  const [aberto, setAberto] = useState(expandidoInicial)
  const [origem, setOrigem] = useState<MobilidadePonto>(() => ({
    nome: String(origemInicial?.nome ?? '').trim(),
    lat: origemInicial?.lat ?? null,
    lng: origemInicial?.lng ?? null,
  }))
  const [destino, setDestino] = useState<MobilidadePonto>(() => ({
    nome: String(destinoInicial?.nome ?? '').trim(),
    lat: destinoInicial?.lat ?? null,
    lng: destinoInicial?.lng ?? null,
  }))
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'error'>('idle')
  const [erro, setErro] = useState('')

  const aplicarOrigem = useCallback(
    (ponto: MobilidadePonto) => {
      setOrigem(ponto)
      onOrigemChange?.(ponto)
    },
    [onOrigemChange],
  )

  const aplicarGps = useCallback(
    async (lat: number, lng: number) => {
      setGpsStatus('loading')
      const endereco = await reverseGeocodeMapbox(lat, lng)
      aplicarOrigem({
        nome: endereco || t('origemGpsLabel'),
        lat,
        lng,
      })
      setGpsStatus('ok')
    },
    [aplicarOrigem, t],
  )

  const solicitarGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error')
      return
    }
    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void aplicarGps(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }, [aplicarGps])

  useEffect(() => {
    if (origemInicial?.lat != null && origemInicial?.lng != null) {
      const nome = String(origemInicial.nome ?? '').trim()
      if (nome && nome !== t('origemGpsLabel')) {
        aplicarOrigem({
          nome,
          lat: origemInicial.lat,
          lng: origemInicial.lng,
        })
        setGpsStatus('ok')
        return
      }
      void aplicarGps(origemInicial.lat, origemInicial.lng)
      return
    }
    solicitarGps()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- boot GPS uma vez

  const onPesquisar = () => {
    setErro('')
    const o: MobilidadePonto = {
      nome: origem.nome.trim(),
      lat: origem.lat,
      lng: origem.lng,
    }
    const d: MobilidadePonto = {
      nome: destino.nome.trim(),
      lat: destino.lat,
      lng: destino.lng,
    }
    if (!pontoPreenchido(o) || !pontoPreenchido(d)) {
      setErro(t('erroOrigemDestino'))
      setAberto(true)
      return
    }
    router.push(
      buildMobilidadePesquisaHref({
        origem: o,
        destino: d,
        abrirPesquisa: true,
      }),
    )
  }

  const resumoDestino = destino.nome.trim() || t('paraOndePlaceholder')

  return (
    <div className={`w-full max-w-lg ${className}`}>
      <div className="overflow-hidden rounded-2xl bg-white/95 shadow-lg ring-1 ring-black/10 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          aria-expanded={aberto}
        >
          <div className="min-w-0">
            <p className="text-base font-extrabold text-[#0097b2]">{t('paraOndeTitulo')}</p>
            {!aberto ? (
              <p className="mt-0.5 truncate text-sm text-gray-500">{resumoDestino}</p>
            ) : null}
          </div>
          {aberto ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
          )}
        </button>

        {aberto ? (
          <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                <Navigation className="h-3.5 w-3.5" aria-hidden />
                {t('origemLabel')}
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={origem.nome}
                  onChange={(e) => {
                    const nome = e.target.value
                    setOrigem((prev) => {
                      const next =
                        nome === prev.nome
                          ? prev
                          : prev.lat != null || prev.lng != null
                            ? { nome, lat: null, lng: null }
                            : { ...prev, nome }
                      onOrigemChange?.(next)
                      return next
                    })
                  }}
                  placeholder={
                    gpsStatus === 'loading'
                      ? t('origemGpsLoading')
                      : gpsStatus === 'denied' || gpsStatus === 'error'
                        ? t('origemManualPlaceholder')
                        : t('origemPlaceholder')
                  }
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2] focus:ring-1 focus:ring-[#0097b2]"
                  autoComplete="street-address"
                />
                <button
                  type="button"
                  onClick={solicitarGps}
                  disabled={gpsStatus === 'loading'}
                  className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 text-[#0097b2] hover:bg-gray-50 disabled:opacity-60"
                  aria-label={t('usarGps')}
                  title={t('usarGps')}
                >
                  <Crosshair className={`h-5 w-5 ${gpsStatus === 'loading' ? 'animate-pulse' : ''}`} />
                </button>
              </div>
              {gpsStatus === 'denied' ? (
                <p className="mt-1 text-xs text-amber-700">{t('gpsNegadoHint')}</p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {t('destinoLabel')}
              </span>
              <input
                type="text"
                value={destino.nome}
                onChange={(e) =>
                  setDestino({
                    nome: e.target.value,
                    lat: null,
                    lng: null,
                  })
                }
                placeholder={t('destinoPlaceholder')}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2] focus:ring-1 focus:ring-[#0097b2]"
                autoComplete="street-address"
              />
            </label>

            {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}

            <button
              type="button"
              onClick={onPesquisar}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-95"
            >
              <Search className="h-5 w-5" aria-hidden />
              {t('pesquisar')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
