'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Car, ChevronDown, ChevronUp, MapPin, Navigation, Route, Search } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import {
  buildMobilidadePesquisaHref,
  pontoPreenchido,
  type MobilidadePonto,
} from '@/lib/mobilidadePesquisaParams'
import { reverseGeocodeMapbox } from '@/lib/mapboxReverseGeocode'
import type { EmpresaMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'
import type { RotaTabelada } from '@/lib/servicosTabeladosCatalogo'
import {
  carregarRotasTabeladasCidade,
  cidadeTripliceParaTabelado,
  inferirCidadeDePonto,
  sugerirDestinosMobilidade,
  type SugestaoDestinoMobilidade,
} from '@/lib/mobilidadePopupPesquisa'

type Props = {
  destinoInicial?: MobilidadePonto | null
  origemInicial?: MobilidadePonto | null
  /** Empresas do mapa (nome fantasia) para autocomplete. */
  empresas?: EmpresaMapaMobilidade[]
  /** Inicia expandido (ex.: deep link). */
  expandidoInicial?: boolean
  className?: string
  onOrigemChange?: (ponto: MobilidadePonto) => void
  /**
   * Se informado, abre o fluxo imediatamente (evita travar quando a URL não muda).
   * Ainda assim atualiza a query via router.
   */
  onPesquisar?: (
    origem: MobilidadePonto,
    destino: MobilidadePonto,
    destinoEmpresaId: string | null,
  ) => void
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
  empresas = [],
  expandidoInicial = false,
  className = '',
  onOrigemChange,
  onPesquisar: onPesquisarProp,
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
  const [destinoEmpresaId, setDestinoEmpresaId] = useState<string | null>(null)
  const [rotasTabeladas, setRotasTabeladas] = useState<RotaTabelada[]>([])
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
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

  useEffect(() => {
    const cidade = inferirCidadeDePonto(origem)
    const tab = cidadeTripliceParaTabelado(cidade)
    if (!tab) {
      setRotasTabeladas([])
      return
    }
    let ativo = true
    void carregarRotasTabeladasCidade(supabase, tab).then((lista) => {
      if (ativo) setRotasTabeladas(lista)
    })
    return () => {
      ativo = false
    }
  }, [origem.lat, origem.lng, origem.nome])

  const sugestoes = useMemo(
    () =>
      sugerirDestinosMobilidade({
        query: destino.nome,
        rotas: rotasTabeladas,
        empresas,
        limite: 12,
      }),
    [destino.nome, rotasTabeladas, empresas],
  )

  const escolherSugestao = (s: SugestaoDestinoMobilidade) => {
    setDestino({
      nome: s.label,
      lat: s.lat,
      lng: s.lng,
    })
    setDestinoEmpresaId(s.empresaId)
    setSugestoesAbertas(false)
    setErro('')
  }

  const onPesquisar = () => {
    setErro('')
    setSugestoesAbertas(false)
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
    onPesquisarProp?.(o, d, destinoEmpresaId)
    router.push(
      buildMobilidadePesquisaHref({
        origem: o,
        destino: d,
        destinoEmpresaId,
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
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="done"
              />
              {gpsStatus === 'denied' ? (
                <p className="mt-1 text-xs text-amber-700">{t('gpsNegadoHint')}</p>
              ) : null}
            </label>

            <div className="relative block">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {t('destinoLabel')}
                </span>
                <input
                  type="text"
                  value={destino.nome}
                  onChange={(e) => {
                    setDestino({
                      nome: e.target.value,
                      lat: null,
                      lng: null,
                    })
                    setDestinoEmpresaId(null)
                    setSugestoesAbertas(true)
                  }}
                  onFocus={() => setSugestoesAbertas(true)}
                  onBlur={() => {
                    window.setTimeout(() => setSugestoesAbertas(false), 180)
                  }}
                  placeholder={t('destinoPlaceholder')}
                  className={fieldClass}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="search"
                  role="combobox"
                  aria-expanded={sugestoesAbertas && sugestoes.length > 0}
                  aria-autocomplete="list"
                />
              </label>

              {sugestoesAbertas && sugestoes.length > 0 ? (
                <ul
                  className="absolute left-0 right-0 z-30 mt-1 max-h-[min(55vh,24rem)] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                  role="listbox"
                >
                  {sugestoes.map((s) => (
                    <li key={s.id} role="option">
                      <button
                        type="button"
                        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[#0097b2]/8"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => escolherSugestao(s)}
                      >
                        {s.tipo === 'empresa' ? (
                          s.fotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.fotoUrl}
                              alt=""
                              className="mt-0.5 h-9 w-9 shrink-0 rounded-lg object-cover bg-gray-100"
                            />
                          ) : (
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0097b2]/15">
                              <Building2 className="h-4 w-4 text-[#0097b2]" aria-hidden />
                            </span>
                          )
                        ) : (
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0097b2]/15">
                            <Route className="h-4 w-4 text-[#0097b2]" aria-hidden />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-gray-900">{s.label}</span>
                          {s.tipo === 'empresa' ? (
                            <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                              {[s.endereco, s.detalhe].filter(Boolean).join(' · ') ||
                                t('sugestaoEmpresa')}
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-[11px] text-gray-500">
                              {t('sugestaoRota')}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}

            <button
              type="button"
              onClick={onPesquisar}
              className="mx-auto flex w-[55%] max-w-[13.5rem] items-center justify-center gap-2 rounded-xl bg-[#00D443] py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-95"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              {t('pesquisar')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
