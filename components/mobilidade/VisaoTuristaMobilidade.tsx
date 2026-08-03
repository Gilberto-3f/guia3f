'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import DrawerPesquisaMobilidade from '@/components/mobilidade/DrawerPesquisaMobilidade'
import PopupResultadoCorridaMobilidade, {
  type ResultadoCorridaMobilidade,
} from '@/components/mobilidade/PopupResultadoCorridaMobilidade'
import CardParaOndeMobilidade from '@/components/mobilidade/CardParaOndeMobilidade'
import OfertaMobilidadeListener from '@/components/mobilidade/OfertaMobilidadeListener'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { supabase } from '@/lib/supabase'
import {
  buildMobilidadePesquisaHref,
  parseMobilidadePesquisaSearchParams,
  pontoPreenchido,
  type MobilidadePesquisaState,
  type MobilidadePonto,
} from '@/lib/mobilidadePesquisaParams'
import { type EmpresaMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'
import { abreviarCidadeTriplice } from '@/lib/mobilidadeRegional'
import type { ProfissionalOnlineMapa } from '@/lib/mobilidadeStatusProfissional'
import {
  parseCidadesAtuacaoProf,
  type VisitanteParceriaMapa,
} from '@/lib/mobilidadeMapaVisitante'
import { resolverContextoMapaMobilidade } from '@/lib/parceriaMapaMobilidade'
import { reverseGeocodeMapbox } from '@/lib/mapboxReverseGeocode'
import {
  carregarRotasTabeladasCidade,
  cidadeTripliceParaTabelado,
  inferirCidadeDePonto,
  peekRotasTabeladasCache,
} from '@/lib/mobilidadePopupPesquisa'

const MapaMobilidade = dynamic(() => import('@/components/mobilidade/MapaMobilidade'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[240px] items-center justify-center bg-[#d8eef2] text-sm text-gray-600">
      Carregando mapa…
    </div>
  ),
})

type Props = {
  /** Se false, omite OfertaMobilidadeListener (já no layout pai). */
  comListener?: boolean
  className?: string
}

/**
 * Visão turista/empresa/ADM: card no topo + mapa ocupando o restante (fluxo normal, não absolute).
 */
export default function VisaoTuristaMobilidade({ comListener = true, className = '' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('Mobilidade')
  const { perfilEhTurista, perfilEhProfissional } = useProfissionalGate()

  const pesquisa = useMemo(
    () => parseMobilidadePesquisaSearchParams(searchParams),
    [searchParams],
  )

  const [empresas, setEmpresas] = useState<EmpresaMapaMobilidade[]>([])
  const [empresasErro, setEmpresasErro] = useState<string | null>(null)
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true)
  const [profissionaisOnline, setProfissionaisOnline] = useState<ProfissionalOnlineMapa[]>([])
  const [visitanteParceria, setVisitanteParceria] = useState<VisitanteParceriaMapa | null>(null)
  const [gpsCentro, setGpsCentro] = useState<{ lat: number; lng: number } | null>(null)
  const [origemLabelGps, setOrigemLabelGps] = useState<string | null>(null)
  const [drawerAberto, setDrawerAberto] = useState(false)
  /** Pesquisa efetiva ao abrir o drawer (evita stale URL enquanto o router ainda não atualizou). */
  const [pesquisaDrawer, setPesquisaDrawer] = useState<MobilidadePesquisaState | null>(null)
  /** Labels prontos no clique (evita flash nome → nome+cidade). */
  const [destinoLabelsSnap, setDestinoLabelsSnap] = useState<{
    curto: string
    completo: string
    nome: string
    cidade: string | null
  } | null>(null)
  /** Remonta o drawer a cada pesquisa — evita flash do layout da etapa anterior. */
  const [drawerKey, setDrawerKey] = useState(0)
  /** Sincroniza destino no card Para Onde? (Chamar corrida / fechar). */
  const [destinoSyncToken, setDestinoSyncToken] = useState(0)
  const [cardDestino, setCardDestino] = useState<{
    ponto: MobilidadePonto
    empresaId: string | null
  } | null>(null)
  const [resultadoCorrida, setResultadoCorrida] = useState<ResultadoCorridaMobilidade | null>(null)
  const [resultadoAberto, setResultadoAberto] = useState(false)
  const gpsCentroRef = useRef(gpsCentro)
  const origemLabelGpsRef = useRef(origemLabelGps)
  const abrindoDrawerRef = useRef(false)
  /** Evita reabrir o drawer no frame em que o X fecha e a URL ainda tem abrir_pesquisa=1. */
  const fecharIgnoraAbrirRef = useRef(false)
  /** openKey do destino que acabamos de fechar — libera se chegar Chamar corrida de outra empresa. */
  const openKeyFechadoRef = useRef<string | null>(null)
  /** Chave do último open via URL — permite trocar de empresa no 2º Chamar corrida. */
  const ultimoOpenKeyRef = useRef<string | null>(null)
  gpsCentroRef.current = gpsCentro
  origemLabelGpsRef.current = origemLabelGps

  const pesquisaAtiva = drawerAberto && pesquisaDrawer ? pesquisaDrawer : pesquisa

  const montarOpenKey = useCallback((p: {
    destinoEmpresaId?: string | null
    destino: MobilidadePonto
  }) => {
    const emp = String(p.destinoEmpresaId ?? '').trim()
    if (emp) return `empresa:${emp}`
    return [
      'geo',
      p.destino.lat ?? '',
      p.destino.lng ?? '',
      String(p.destino.nome ?? '').trim(),
    ].join('|')
  }, [])

  const aplicarDestinoNoCard = useCallback(
    (ponto: MobilidadePonto | null, empresaId: string | null) => {
      if (
        ponto != null &&
        (pontoPreenchido(ponto) || (empresaId != null && String(empresaId).trim() !== ''))
      ) {
        setCardDestino({ ponto, empresaId })
      } else {
        setCardDestino(null)
      }
      setDestinoSyncToken((n) => n + 1)
    },
    [],
  )

  const montarLabelsDestino = useCallback(
    (
      empId: string | null | undefined,
      destinoNome: string,
      listaEmpresas: EmpresaMapaMobilidade[] = empresas,
    ): {
      curto: string
      completo: string
      nome: string
      cidade: string | null
    } => {
      const emp = empId ? listaEmpresas.find((e) => e.id === empId) : undefined
      if (emp) {
        const abrev = abreviarCidadeTriplice(emp.cidade)
        return {
          nome: emp.nome_fantasia,
          cidade: emp.cidade || null,
          curto: abrev ? `${emp.nome_fantasia} · ${abrev}` : emp.nome_fantasia,
          completo: [emp.nome_fantasia, emp.endereco, emp.cidade].filter(Boolean).join(' · '),
        }
      }
      const nome = destinoNome.trim()
      return { nome, cidade: null, curto: nome, completo: nome }
    },
    [empresas],
  )

  /** Sempre preenche origem com GPS atual (coords + endereço quando disponível). */
  const garantirOrigemGps = useCallback(async (next: MobilidadePesquisaState): Promise<MobilidadePesquisaState> => {
    const temCoords =
      next.origem.lat != null &&
      next.origem.lng != null &&
      Number.isFinite(next.origem.lat) &&
      Number.isFinite(next.origem.lng)

    if (temCoords && next.origem.nome.trim()) return next

    let lat = temCoords ? next.origem.lat : gpsCentroRef.current?.lat ?? null
    let lng = temCoords ? next.origem.lng : gpsCentroRef.current?.lng ?? null
    let nome = next.origem.nome.trim() || origemLabelGpsRef.current || ''

    if (lat == null || lng == null) {
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          resolve(null)
          return
        }
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
        )
      })
      if (pos) {
        lat = pos.coords.latitude
        lng = pos.coords.longitude
        setGpsCentro({ lat, lng })
      }
    }

    if (lat != null && lng != null && !nome) {
      const addr = await reverseGeocodeMapbox(lat, lng)
      if (addr) {
        nome = addr
        setOrigemLabelGps(addr)
      }
    }

    if (lat == null || lng == null) return next
    return {
      ...next,
      origem: { nome, lat, lng },
    }
  }, [])

  /** Prefetch rotas + labels antes do 1º paint do drawer (evita flash). */
  const abrirDrawerPesquisa = useCallback(
    async (raw: MobilidadePesquisaState) => {
      if (fecharIgnoraAbrirRef.current) return
      abrindoDrawerRef.current = true
      try {
        const next = await garantirOrigemGps(raw)
        if (fecharIgnoraAbrirRef.current) return
        const cidade = inferirCidadeDePonto(next.origem)
        const tab = cidadeTripliceParaTabelado(cidade)
        if (tab && !peekRotasTabeladasCache(tab)) {
          await carregarRotasTabeladasCidade(supabase, tab)
        }
        if (fecharIgnoraAbrirRef.current) return
        const labels = montarLabelsDestino(next.destinoEmpresaId, next.destino.nome)
        // Card Para Onde? recebe o destino antes/junto da abertura do drawer 1.
        aplicarDestinoNoCard(next.destino, next.destinoEmpresaId)
        setDestinoLabelsSnap(labels)
        setDrawerKey((k) => k + 1)
        setPesquisaDrawer(next)
        setDrawerAberto(true)
        openKeyFechadoRef.current = null
      } finally {
        abrindoDrawerRef.current = false
      }
    },
    [garantirOrigemGps, montarLabelsDestino, aplicarDestinoNoCard],
  )

  /** Deep link / Chamar corrida: abre drawer 1 com destino da empresa + origem GPS. */
  useEffect(() => {
    if (!pesquisa.abrirPesquisa) {
      fecharIgnoraAbrirRef.current = false
      openKeyFechadoRef.current = null
      return
    }

    const openKey = montarOpenKey(pesquisa)

    // Bloqueio só vale para o mesmo destino que acabamos de fechar (X/Cancelar).
    // Novo Chamar corrida (outra empresa / outro openKey) libera na hora.
    if (fecharIgnoraAbrirRef.current) {
      if (openKeyFechadoRef.current != null && openKey !== openKeyFechadoRef.current) {
        fecharIgnoraAbrirRef.current = false
        openKeyFechadoRef.current = null
      } else {
        return
      }
    }

    if (abrindoDrawerRef.current) return
    if (pesquisa.destinoEmpresaId && carregandoEmpresas) return

    // Já aberto com o mesmo destino — não remonta.
    if (drawerAberto && ultimoOpenKeyRef.current === openKey) return

    let ativo = true
    void (async () => {
      let next: MobilidadePesquisaState = { ...pesquisa, abrirPesquisa: true }
      const empId = next.destinoEmpresaId

      let emp = empId != null ? empresas.find((e) => e.id === empId) ?? null : null
      let listaEmp = empresas

      if (empId && !emp) {
        const { data } = await supabase
          .from('empresas')
          .select('id, nome_fantasia, cidade, endereco, latitude, longitude')
          .eq('id', empId)
          .maybeSingle()
        if (!ativo) return
        if (data) {
          const lat = Number(data.latitude)
          const lng = Number(data.longitude)
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            emp = {
              id: String(data.id),
              nome_fantasia: String(data.nome_fantasia ?? ''),
              nome_usuario: null,
              descricao_curta: null,
              categoria: '',
              cidade: String(data.cidade ?? ''),
              endereco:
                data.endereco != null && String(data.endereco).trim()
                  ? String(data.endereco).trim()
                  : null,
              bairro: null,
              status: null,
              docs_verificado: null,
              nota_media: null,
              total_avaliacoes: null,
              latitude: lat,
              longitude: lng,
              foto_url: null,
              whatsapp: null,
              preco_ticket_inteira: null,
              preco_ticket_meia: null,
              preco_diaria: null,
              segmento: '',
            }
            listaEmp = [...empresas, emp]
            setEmpresas((prev) => (prev.some((e) => e.id === emp!.id) ? prev : [...prev, emp!]))
          }
        }
      }

      if (emp) {
        next = {
          ...next,
          destino: {
            nome: emp.nome_fantasia,
            lat: emp.latitude,
            lng: emp.longitude,
          },
          destinoEmpresaId: emp.id,
        }
        setDestinoLabelsSnap(montarLabelsDestino(emp.id, emp.nome_fantasia, listaEmp))
      }

      if (!ativo || fecharIgnoraAbrirRef.current) return
      ultimoOpenKeyRef.current = openKey
      await abrirDrawerPesquisa(next)
    })()

    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep link / Chamar corrida
  }, [
    pesquisa.abrirPesquisa,
    pesquisa.destinoEmpresaId,
    pesquisa.destino.lat,
    pesquisa.destino.lng,
    pesquisa.destino.nome,
    carregandoEmpresas,
    empresas,
    drawerAberto,
    abrirDrawerPesquisa,
    montarLabelsDestino,
    montarOpenKey,
  ])

  const fecharDrawerPesquisa = () => {
    // Usa a mesma openKey da URL (não a enriquecida) para o bloqueio bater com o effect.
    openKeyFechadoRef.current = ultimoOpenKeyRef.current ?? montarOpenKey(pesquisa)
    fecharIgnoraAbrirRef.current = true
    ultimoOpenKeyRef.current = null
    abrindoDrawerRef.current = false
    setDrawerAberto(false)
    setPesquisaDrawer(null)
    setDestinoLabelsSnap(null)
    // Limpa o buscador Para Onde? — próximo Chamar corrida começa vazio.
    aplicarDestinoNoCard(null, null)
    router.replace(
      buildMobilidadePesquisaHref({
        origem: {
          nome: origemLabelGps || pesquisaAtiva.origem.nome || '',
          lat: gpsCentro?.lat ?? pesquisaAtiva.origem.lat,
          lng: gpsCentro?.lng ?? pesquisaAtiva.origem.lng,
        },
        destino: { nome: '', lat: null, lng: null },
        destinoEmpresaId: null,
        recomendacaoId: null,
        profissionalUsuarioId: null,
        abrirPesquisa: false,
      }),
    )
  }

  const reabrirDrawerParaAgendar = () => {
    setResultadoAberto(false)
    setResultadoCorrida(null)
    fecharIgnoraAbrirRef.current = false
    const next: MobilidadePesquisaState = {
      ...pesquisa,
      origem: pesquisaAtiva.origem,
      destino: pesquisaAtiva.destino,
      destinoEmpresaId: pesquisaAtiva.destinoEmpresaId,
      abrirPesquisa: true,
    }
    void abrirDrawerPesquisa(next)
    router.replace(buildMobilidadePesquisaHref(next))
  }

  useEffect(() => {
    if (!perfilEhProfissional) {
      setVisitanteParceria(null)
      return
    }
    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid || !ativo) return
      const { data: prof } = await supabase
        .from('profissionais')
        .select('placa_vermelha, categorias, cidade_atuacao')
        .eq('usuario_id', uid)
        .maybeSingle()
      if (!ativo) return
      if (!prof) {
        setVisitanteParceria(null)
        return
      }
      setVisitanteParceria({
        placaVermelha: Boolean(prof.placa_vermelha),
        categorias: Array.isArray(prof.categorias)
          ? prof.categorias.filter((c): c is string => typeof c === 'string')
          : [],
        cidadesAtuacao: parseCidadesAtuacaoProf(prof.cidade_atuacao),
      })
    })()
    return () => {
      ativo = false
    }
  }, [perfilEhProfissional])

  useEffect(() => {
    let ativo = true
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const carregar = async (tentativa: number) => {
      try {
        const res = await fetch('/api/mobilidade/empresas-mapa')
        const json = (await res.json()) as {
          empresas?: EmpresaMapaMobilidade[]
          error?: string
        }
        if (!ativo) return
        if (!res.ok) {
          setEmpresas([])
          // 503/timeout: silencioso + 1 retry (não martelar)
          if ((res.status === 503 || res.status >= 500) && tentativa < 1) {
            setEmpresasErro(null)
            retryTimer = setTimeout(() => {
              if (ativo) void carregar(tentativa + 1)
            }, 3500)
            return
          }
          setEmpresasErro(String(json.error ?? 'Falha ao carregar atrativos.'))
        } else {
          setEmpresas(Array.isArray(json.empresas) ? json.empresas : [])
          setEmpresasErro(null)
        }
      } catch {
        if (!ativo) return
        setEmpresas([])
        if (tentativa < 1) {
          retryTimer = setTimeout(() => {
            if (ativo) void carregar(tentativa + 1)
          }, 3500)
          return
        }
        setEmpresasErro('Falha de rede ao carregar atrativos.')
      } finally {
        if (ativo && tentativa === 0) {
          setCarregandoEmpresas(false)
        }
      }
    }

    setCarregandoEmpresas(true)
    void carregar(0)
    return () => {
      ativo = false
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  useEffect(() => {
    let ativo = true
    const load = async () => {
      try {
        const res = await fetch('/api/mobilidade/profissionais-online')
        const json = (await res.json()) as { profissionais?: ProfissionalOnlineMapa[] }
        if (!ativo || !res.ok) return
        setProfissionaisOnline(Array.isArray(json.profissionais) ? json.profissionais : [])
      } catch {
        /* ignore */
      }
    }
    // Atrasa o 1º fetch para não competir com empresas-mapa no first load
    const boot = window.setTimeout(() => {
      if (!ativo) return
      void load()
    }, 4000)
    const id = setInterval(() => void load(), 90_000)
    return () => {
      ativo = false
      window.clearTimeout(boot)
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (pesquisa.origem.lat != null && pesquisa.origem.lng != null) {
      setGpsCentro({ lat: pesquisa.origem.lat, lng: pesquisa.origem.lng })
      const nome = String(pesquisa.origem.nome ?? '').trim()
      if (nome) setOrigemLabelGps(nome)
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setGpsCentro({ lat, lng })
        void reverseGeocodeMapbox(lat, lng).then((addr) => {
          if (addr) setOrigemLabelGps(addr)
        })
      },
      () => {
        /* mantém fallback do mapa */
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }, [pesquisa.origem.lat, pesquisa.origem.lng, pesquisa.origem.nome])

  const contextoMapa = useMemo(() => {
    if (perfilEhTurista) return 'turista' as const
    if (!perfilEhProfissional || !visitanteParceria) return null
    return resolverContextoMapaMobilidade({
      perfilEhTurista: false,
      perfilEhProfissional: true,
      visitantePlacaVermelha: visitanteParceria.placaVermelha,
      visitanteCategorias: visitanteParceria.categorias,
    })
  }, [perfilEhTurista, perfilEhProfissional, visitanteParceria])

  const destinoPonto = useMemo(() => {
    const p = pesquisaAtiva
    if (p.destino.lat != null && p.destino.lng != null) {
      return {
        lat: p.destino.lat,
        lng: p.destino.lng,
        label: p.destino.nome || undefined,
      }
    }
    if (p.destinoEmpresaId) {
      const emp = empresas.find((e) => e.id === p.destinoEmpresaId)
      if (emp) return { lat: emp.latitude, lng: emp.longitude, label: emp.nome_fantasia }
    }
    return null
  }, [pesquisaAtiva, empresas])

  const origemPonto =
    pesquisaAtiva.origem.lat != null && pesquisaAtiva.origem.lng != null
      ? {
          lat: pesquisaAtiva.origem.lat,
          lng: pesquisaAtiva.origem.lng,
          label: pesquisaAtiva.origem.nome || origemLabelGps || undefined,
        }
      : gpsCentro
        ? { ...gpsCentro, label: origemLabelGps || undefined }
        : null

  const origemInicialCard: MobilidadePonto | null =
    pesquisa.origem.lat != null
      ? pesquisa.origem
      : gpsCentro
        ? {
            nome: origemLabelGps || '',
            lat: gpsCentro.lat,
            lng: gpsCentro.lng,
          }
        : null

  const destinoInicialCard: MobilidadePonto | null =
    cardDestino?.ponto ??
    (pontoPreenchido(pesquisa.destino)
      ? pesquisa.destino
      : pesquisa.destinoEmpresaId
        ? {
            nome:
              empresas.find((e) => e.id === pesquisa.destinoEmpresaId)?.nome_fantasia ||
              t('destinoEmpresa'),
            lat: destinoPonto?.lat ?? null,
            lng: destinoPonto?.lng ?? null,
          }
        : null)

  const destinoEmpresaIdCard =
    cardDestino?.empresaId ?? pesquisa.destinoEmpresaId ?? null

  const empresaDestino = pesquisaAtiva.destinoEmpresaId
    ? empresas.find((e) => e.id === pesquisaAtiva.destinoEmpresaId) ?? null
    : null

  const destinoNomeEmpresa = destinoLabelsSnap?.nome ?? empresaDestino?.nome_fantasia ?? null
  const destinoCidadeEmpresa = destinoLabelsSnap?.cidade ?? empresaDestino?.cidade ?? null
  const destinoLabelCurtoEmpresa =
    destinoLabelsSnap?.curto ??
    (empresaDestino != null
      ? [empresaDestino.nome_fantasia, abreviarCidadeTriplice(empresaDestino.cidade)]
          .filter(Boolean)
          .join(' · ')
      : null)
  const destinoLabelCompletoEmpresa =
    destinoLabelsSnap?.completo ??
    (empresaDestino != null
      ? [empresaDestino.nome_fantasia, empresaDestino.endereco, empresaDestino.cidade]
          .filter(Boolean)
          .join(' · ')
      : null)

  return (
    <div
      className={`relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#e8f4f6] ${className}`}
    >
      {/* Mapa full-bleed — até a bottom bar; card flutua por cima. */}
      <div className="absolute inset-0 z-0">
        <MapaMobilidade
          empresas={empresas}
          profissionais={profissionaisOnline}
          centro={gpsCentro}
          origem={origemPonto}
          destino={destinoPonto}
          contextoMapa={contextoMapa ?? 'turista'}
          visitanteParceria={visitanteParceria}
          carregandoPins={carregandoEmpresas}
        />
        {carregandoEmpresas ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[5] flex justify-center">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-gray-600 shadow">
              {t('carregandoPins')}
            </span>
          </div>
        ) : null}
      </div>

      {/* Overlay: card flutuante (não empurra o mapa ao abrir). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-2">
        {empresasErro ? (
          <p className="pointer-events-auto mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {empresasErro}
          </p>
        ) : null}
        <div className="pointer-events-auto mx-auto w-full max-w-lg">
          <CardParaOndeMobilidade
            origemInicial={origemInicialCard}
            destinoInicial={destinoInicialCard}
            destinoEmpresaIdInicial={destinoEmpresaIdCard}
            destinoSyncToken={destinoSyncToken}
            empresas={empresas}
            forcarRecolhido={drawerAberto}
            expandidoInicial={
              Boolean(pesquisa.abrirPesquisa) ||
              pontoPreenchido(pesquisa.destino) ||
              Boolean(pesquisa.destinoEmpresaId) ||
              Boolean(cardDestino)
            }
            onOrigemChange={(p) => {
              if (p.lat != null && p.lng != null) {
                setGpsCentro({ lat: p.lat, lng: p.lng })
                if (p.nome) setOrigemLabelGps(p.nome)
              }
            }}
            onPesquisar={(o, d, empId) => {
              setResultadoAberto(false)
              setResultadoCorrida(null)
              fecharIgnoraAbrirRef.current = false
              openKeyFechadoRef.current = null
              ultimoOpenKeyRef.current = montarOpenKey({
                destinoEmpresaId: empId,
                destino: d,
              })
              void abrirDrawerPesquisa({
                origem: o,
                destino: d,
                destinoEmpresaId: empId,
                abrirPesquisa: true,
                recomendacaoId: null,
                profissionalUsuarioId: null,
              })
            }}
          />
        </div>
      </div>

      {drawerAberto ? (
        <DrawerPesquisaMobilidade
          key={`pesquisa-drawer-${drawerKey}`}
          aberto
          onFechar={fecharDrawerPesquisa}
          pesquisa={pesquisaAtiva}
          destinoCidadeEmpresa={destinoCidadeEmpresa}
          destinoNomeEmpresa={destinoNomeEmpresa}
          destinoLabelCurto={destinoLabelCurtoEmpresa}
          destinoLabelCompleto={destinoLabelCompletoEmpresa}
          onResultado={(r) => {
            setResultadoCorrida(r)
            setResultadoAberto(true)
          }}
        />
      ) : null}

      <PopupResultadoCorridaMobilidade
        aberto={resultadoAberto}
        resultado={resultadoCorrida}
        onFechar={() => {
          setResultadoAberto(false)
          setResultadoCorrida(null)
        }}
        onReabrirAgendar={reabrirDrawerParaAgendar}
      />

      {comListener ? <OfertaMobilidadeListener /> : null}
    </div>
  )
}
