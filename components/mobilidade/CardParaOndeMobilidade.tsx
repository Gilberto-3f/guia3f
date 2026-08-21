'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Car, ChevronDown, ChevronUp, MapPin, Navigation, Route, Search, X, ArrowLeft } from 'lucide-react'
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
import CardParteAtendimentoFlutuante from '@/components/mobilidade/CardParteAtendimentoFlutuante'
import {
  ehAtendimentoImediatoAtivo,
  MOBILIDADE_CORRIDA_TURISTA,
  MOBILIDADE_LIMPAR_PESQUISA,
  pedirAbrirDrawerAtendimentoAtivo,
  type CorridaTuristaFlutuante,
} from '@/lib/mobilidadeAtendimentoAtivoEventos'

const TECLADO_BOTTOM_BAR_EVENT = 'guia-criar-keyboard'
const VERDE = '#00D443'

type ProfissionalCorrida = {
  nome: string
  username: string | null
  foto_url: string | null
  verificado: boolean
  nota_media: number | null
}

type CorridaTuristaResumo = {
  solicitacao_id: string
  status: string
  data_agendada?: string | null
  profissional?: ProfissionalCorrida | null
}

type Props = {
  destinoInicial?: MobilidadePonto | null
  /** Empresa vinculada ao destino (Chamar corrida / sugestão). */
  destinoEmpresaIdInicial?: string | null
  /**
   * Incrementado pelo pai ao aplicar/limpar destino (Chamar corrida, fechar drawer).
   * Sem isso o estado local do card não acompanha a URL.
   */
  destinoSyncToken?: number
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
  /** Força o card recolhido (ex.: enquanto o drawer de pesquisa está aberto). */
  forcarRecolhido?: boolean
  /** Voltar ao card anterior (ex.: anfitrião). */
  onVoltar?: () => void
}

const fieldClass =
  'w-full rounded-xl border border-white/25 bg-[#0097b2] px-3 py-2.5 text-sm text-white placeholder:text-white/70 outline-none focus:ring-2 focus:ring-white/40'

function emitTecladoBarra(hide: boolean) {
  try {
    window.dispatchEvent(new CustomEvent(TECLADO_BOTTOM_BAR_EVENT, { detail: { hide } }))
  } catch {
    /* ignore */
  }
}

/**
 * Card colapsável "Para Onde?" — fixo no topo; painel abre para baixo.
 * GPS automático no boot (sem botão de mira).
 */
export default function CardParaOndeMobilidade({
  destinoInicial = null,
  destinoEmpresaIdInicial = null,
  destinoSyncToken = 0,
  origemInicial = null,
  empresas = [],
  expandidoInicial = false,
  className = '',
  onOrigemChange,
  onPesquisar: onPesquisarProp,
  forcarRecolhido = false,
  onVoltar,
}: Props) {
  const t = useTranslations('Mobilidade')
  const router = useRouter()
  const listaRef = useRef<HTMLUListElement | null>(null)

  const [aberto, setAberto] = useState(expandidoInicial && !forcarRecolhido)
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
  const [destinoEmpresaId, setDestinoEmpresaId] = useState<string | null>(
    () => destinoEmpresaIdInicial,
  )
  const [rotasTabeladas, setRotasTabeladas] = useState<RotaTabelada[]>([])
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
  const [campoFocado, setCampoFocado] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'error'>('idle')
  const [erro, setErro] = useState('')
  const [corridaAtiva, setCorridaAtiva] = useState<CorridaTuristaResumo | null>(null)

  useEffect(() => {
    const onPoll = (ev: Event) => {
      const detail = (ev as CustomEvent<CorridaTuristaFlutuante | null>).detail
      setCorridaAtiva(detail ?? null)
    }
    window.addEventListener(MOBILIDADE_CORRIDA_TURISTA, onPoll)
    return () => window.removeEventListener(MOBILIDADE_CORRIDA_TURISTA, onPoll)
  }, [])

  /** Chamar corrida / fechar drawer: aplica ou limpa o destino sem remount (preserva GPS). */
  useEffect(() => {
    const nome = String(destinoInicial?.nome ?? '').trim()
    const lat = destinoInicial?.lat ?? null
    const lng = destinoInicial?.lng ?? null
    const empId =
      destinoEmpresaIdInicial != null && String(destinoEmpresaIdInicial).trim() !== ''
        ? String(destinoEmpresaIdInicial).trim()
        : null
    const preenchido =
      Boolean(nome) ||
      (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) ||
      Boolean(empId)

    if (!preenchido) {
      setDestino({ nome: '', lat: null, lng: null })
      setDestinoEmpresaId(null)
      setSugestoesAbertas(false)
      setErro('')
      return
    }
    setDestino({ nome, lat, lng })
    setDestinoEmpresaId(empId)
  }, [
    destinoSyncToken,
    destinoInicial?.nome,
    destinoInicial?.lat,
    destinoInicial?.lng,
    destinoEmpresaIdInicial,
  ])

  useEffect(() => {
    const onLimpar = () => {
      setDestino({ nome: '', lat: null, lng: null })
      setDestinoEmpresaId(null)
      setSugestoesAbertas(false)
      setErro('')
    }
    window.addEventListener(MOBILIDADE_LIMPAR_PESQUISA, onLimpar)
    return () => window.removeEventListener(MOBILIDADE_LIMPAR_PESQUISA, onLimpar)
  }, [])

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
    if (forcarRecolhido) setAberto(false)
  }, [forcarRecolhido])

  const emAtendimento = Boolean(
    corridaAtiva &&
      ehAtendimentoImediatoAtivo({
        status: corridaAtiva.status,
        data_agendada: corridaAtiva.data_agendada,
      }),
  )

  useEffect(() => {
    if (emAtendimento && !forcarRecolhido) setAberto(true)
  }, [emAtendimento, corridaAtiva?.solicitacao_id, forcarRecolhido])

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

  /** Esconde BottomBar + trava scroll do fundo enquanto o teclado/campo está ativo. */
  useEffect(() => {
    const ativo = campoFocado || sugestoesAbertas
    emitTecladoBarra(ativo)
    if (!ativo || typeof document === 'undefined') {
      return () => emitTecladoBarra(false)
    }

    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevBodyTouch = body.style.touchAction
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.touchAction = 'none'

    const bloquearFundo = (e: TouchEvent) => {
      const lista = listaRef.current
      if (lista && e.target instanceof Node && lista.contains(e.target)) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', bloquearFundo, { passive: false })

    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      body.style.touchAction = prevBodyTouch
      document.removeEventListener('touchmove', bloquearFundo)
      emitTecladoBarra(false)
    }
  }, [campoFocado, sugestoesAbertas])

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

  const mostrarLista = sugestoesAbertas && sugestoes.length > 0

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
    setCampoFocado(false)
    emitTecladoBarra(false)
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
    // Fecha o card antes do drawer — evita flash do layout expandido (origem+destino).
    setAberto(false)
    setCampoFocado(false)
    setSugestoesAbertas(false)
    emitTecladoBarra(false)
    if (typeof document !== 'undefined') {
      const ae = document.activeElement
      if (ae instanceof HTMLElement) ae.blur()
    }
    onPesquisarProp?.(o, d, destinoEmpresaId)
    router.push(
      buildMobilidadePesquisaHref({
        origem: o,
        destino: d,
        destinoEmpresaId,
        abrirPesquisa: true,
        modo: 'algoritmo',
        recomendacaoId: null,
        profissionalUsuarioId: null,
      }),
    )
  }

  const painelAberto = aberto && !forcarRecolhido
  const resumoDestino = destino.nome.trim() || t('paraOndePlaceholder')

  if (emAtendimento) {
    const st = String(corridaAtiva?.status ?? '')
    const titulo =
      st === 'em_viagem'
        ? t('drawerAtivoInicio')
        : st === 'no_local'
          ? t('chegadaProTitulo')
          : st === 'a_caminho'
            ? t('drawerAtivoMotoristaACaminho')
            : t('drawerAtivoEmAndamento')

    return (
      <div className={`w-full max-w-lg ${className}`}>
        <div
          className={`bg-white shadow-lg ring-1 ring-black/10 ${
            painelAberto ? 'rounded-2xl' : 'overflow-hidden rounded-2xl'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              if (forcarRecolhido) return
              setAberto((v) => !v)
            }}
            className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-white ${
              painelAberto ? 'rounded-t-2xl' : 'rounded-2xl'
            }`}
            style={{ backgroundColor: VERDE }}
            aria-expanded={painelAberto}
            aria-label={titulo}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Car className="h-5 w-5 shrink-0 text-white" aria-hidden strokeWidth={2} />
              <p className="text-base font-extrabold uppercase tracking-wide text-white">{titulo}</p>
            </div>
            {painelAberto ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-white" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-white" aria-hidden />
            )}
          </button>

          {painelAberto ? (
            <div className="space-y-3 rounded-b-2xl bg-white px-4 pb-4 pt-3">
              <CardParteAtendimentoFlutuante
                parte={
                  corridaAtiva?.profissional
                    ? {
                        nome: corridaAtiva.profissional.nome,
                        username: corridaAtiva.profissional.username,
                        foto_url: corridaAtiva.profissional.foto_url,
                        verificado: corridaAtiva.profissional.verificado,
                        nota_media: corridaAtiva.profissional.nota_media,
                      }
                    : null
                }
                fallbackNome={t('atendimentoProfissionalFallback')}
                onAbrir={pedirAbrirDrawerAtendimentoAtivo}
                ariaLabel={t('drawerAtivoAbrirDetalhe')}
              />
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full max-w-lg ${className}`}>
      {/* overflow-hidden só fechado (quinas); aberto sem overflow p/ não cortar autocomplete. */}
      <div
        className={`bg-white shadow-lg ring-1 ring-black/10 ${
          painelAberto ? 'rounded-2xl' : 'overflow-hidden rounded-2xl'
        }`}
      >
        <div
          className={`flex w-full items-center gap-1 bg-[#0097b2] px-2 py-2 text-white ${
            painelAberto ? 'rounded-t-2xl' : 'rounded-2xl'
          }`}
        >
          {onVoltar ? (
            <button
              type="button"
              onClick={onVoltar}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/90 hover:bg-white/15"
              aria-label={t('voltarAnfitriao')}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (forcarRecolhido) return
              setAberto((v) => !v)
            }}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-1.5 text-left text-white"
            aria-expanded={painelAberto}
            aria-label={painelAberto ? t('paraOndeTitulo') : `${t('paraOndeTitulo')}. ${resumoDestino}`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Car className="h-5 w-5 shrink-0 text-white" aria-hidden strokeWidth={2} />
              <p className="text-base font-extrabold text-white">{t('paraOndeTitulo')}</p>
            </div>
            {painelAberto ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-white" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-white" aria-hidden />
            )}
          </button>
        </div>

        {painelAberto ? (
          <div className="space-y-3 rounded-b-2xl bg-white px-4 pb-4 pt-3">
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
                onFocus={() => setCampoFocado(true)}
                onBlur={() => {
                  window.setTimeout(() => setCampoFocado(false), 200)
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

            <div className="block">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {t('destinoLabel')}
                </span>
                <span className="relative block">
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
                    onFocus={() => {
                      setCampoFocado(true)
                      setSugestoesAbertas(true)
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setSugestoesAbertas(false)
                        setCampoFocado(false)
                      }, 200)
                    }}
                    placeholder={t('destinoPlaceholder')}
                    className={`${fieldClass}${destino.nome.trim() ? ' pr-10' : ''}`}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    inputMode="text"
                    enterKeyHint="search"
                    role="combobox"
                    aria-expanded={mostrarLista}
                    aria-autocomplete="list"
                  />
                  {destino.nome.trim() ? (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
                      aria-label={t('limparDestino')}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDestino({ nome: '', lat: null, lng: null })
                        setDestinoEmpresaId(null)
                        setSugestoesAbertas(false)
                        setErro('')
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden strokeWidth={2.5} />
                    </button>
                  ) : null}
                </span>
              </label>

              {/* Lista no fluxo (não absolute) — pelo menos ~3 itens visíveis; só ela rola. */}
              {mostrarLista ? (
                <ul
                  ref={listaRef}
                  className="mt-2 max-h-[min(42vh,13.5rem)] min-h-[10.5rem] touch-pan-y overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white py-1 shadow-md"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  role="listbox"
                  onTouchMove={(e) => e.stopPropagation()}
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
