'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Car, ChevronDown, ChevronUp, MapPin, Navigation, Search } from 'lucide-react'
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

const fieldClass =
  'w-full rounded-xl border border-white/25 bg-[#0097b2] px-3 py-2.5 text-sm text-white placeholder:text-white/70 outline-none focus:ring-2 focus:ring-white/40'

/**
 * Card colapsável "Para Onde?" — fixo no topo; painel abre para baixo.
 * GPS automático no boot (sem botão de mira).
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
        nome: endereco || '',
        lat,
        lng,
      })
      setGpsStatus(endereco ? 'ok' : 'error')
    },
    [aplicarOrigem],
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
      const labelGenerico = t('origemGpsLabel')
      if (nome && nome !== labelGenerico) {
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
      <div className="overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/10">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex w-full items-center justify-between gap-3 bg-[#0097b2] px-4 py-3.5 text-left text-white"
          aria-expanded={aberto}
          aria-label={aberto ? t('paraOndeTitulo') : `${t('paraOndeTitulo')}. ${resumoDestino}`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Car className="h-5 w-5 shrink-0 text-white" aria-hidden strokeWidth={2} />
            <p className="text-base font-extrabold text-white">{t('paraOndeTitulo')}</p>
          </div>
          {aberto ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-white" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-white" aria-hidden />
          )}
        </button>

        {aberto ? (
          <div className="space-y-3 bg-white px-4 pb-4 pt-3">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                <Navigation className="h-3.5 w-3.5" aria-hidden />
                {t('origemLabel')}
              </span>
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
                className={fieldClass}
                autoComplete="street-address"
              />
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
                className={fieldClass}
                autoComplete="street-address"
              />
            </label>

            {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}

            <button
              type="button"
              onClick={onPesquisar}
              className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#00D443] text-[13px] font-bold uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-95"
            >
              <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('pesquisar')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
