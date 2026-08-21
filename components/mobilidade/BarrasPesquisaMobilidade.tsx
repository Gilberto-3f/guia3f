'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Crosshair, MapPin, Navigation, Search } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import {
  buildMobilidadePesquisaHref,
  pontoPreenchido,
  type MobilidadePonto,
} from '@/lib/mobilidadePesquisaParams'

type Props = {
  /** Prefill destino (ex.: deep link futuro). */
  destinoInicial?: MobilidadePonto | null
  className?: string
}

export default function BarrasPesquisaMobilidade({ destinoInicial = null, className = '' }: Props) {
  const t = useTranslations('Mobilidade')
  const router = useRouter()

  const [origem, setOrigem] = useState<MobilidadePonto>({ nome: '', lat: null, lng: null })
  const [destino, setDestino] = useState<MobilidadePonto>(() => ({
    nome: String(destinoInicial?.nome ?? '').trim(),
    lat: destinoInicial?.lat ?? null,
    lng: destinoInicial?.lng ?? null,
  }))
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'error'>('idle')
  const [erro, setErro] = useState('')

  const aplicarGps = useCallback((lat: number, lng: number) => {
    setOrigem({
      nome: t('origemGpsLabel'),
      lat,
      lng,
    })
    setGpsStatus('ok')
  }, [t])

  const solicitarGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error')
      return
    }
    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        aplicarGps(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }, [aplicarGps])

  useEffect(() => {
    solicitarGps()
  }, [solicitarGps])

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
      return
    }
    router.push(
      buildMobilidadePesquisaHref({
        origem: o,
        destino: d,
        abrirPesquisa: true,
        modo: 'algoritmo',
        recomendacaoId: null,
        profissionalUsuarioId: null,
      }),
    )
  }

  return (
    <div className={`w-full max-w-lg mx-auto ${className}`}>
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
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
                  if (nome === prev.nome) return prev
                  // Edição manual após GPS: passa a usar só o texto do endereço
                  if (prev.lat != null || prev.lng != null) {
                    return { nome, lat: null, lng: null }
                  }
                  return { ...prev, nome }
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
    </div>
  )
}
