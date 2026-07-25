'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { ArrowLeft, Check, ChevronDown, MapPin, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CardAtrativo from '@/components/CardAtrativo'
import BuscadorGuiaSegmento from '@/components/guia/BuscadorGuiaSegmento'
import PopupQuestionarioHospedagemCheck from '@/components/PopupQuestionarioHospedagemCheck'
import { empresaCorrespondeBusca } from '@/lib/palavrasChaveGuia'
import { registrarBuscaGuia } from '@/lib/buscasGuia'
import {
  empresaTemBotaoDinamicoPublico,
  type PlanoResumoServicos,
} from '@/lib/planosEmpresaServicosGate'
import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'
import { buscarMapaDegustacaoAtivaPorEmpresas } from '@/lib/degustacaoEmpresa'
import {
  assinaturaContratadaVigente,
  buscarAssinaturasPresencaPublica,
} from '@/lib/empresaAssinatura'
import { buscarEmpresasListagemGuia } from '@/lib/empresaGuiaVisibilidade'
import {
  filtrarEmpresasPorQuestionarioHospedagem,
  type CriteriosFiltroHospedagemCheck,
} from '@/lib/hospedagemFiltroCheck'

import {
  categoriaDbPorSlugGuia,
  cidadeGuiaPorPais,
  TITULO_SLUG_GUIA,
  type PaisGuiaFiltro,
} from '@/lib/segmentosEmpresaGuia'

/** Slugs extras (fora dos 5 segmentos comerciais principais). */
const SLUG_CATEGORIA_EXTRA: Record<string, string> = {
  compras: 'Compras Paraguai',
  eventos: 'Eventos',
  mobilidade: 'Mobilidade',
}

const TITULO_CATEGORIA_EXTRA: Record<string, string> = {
  compras: 'Compras Paraguai',
  eventos: 'Eventos',
  mobilidade: 'Mobilidade',
}

type Empresa = {
  id: string
  nome_fantasia: string
  nome_usuario: string | null
  foto_url: string | null
  descricao_curta: string | null
  nota_media: number | null
  total_avaliacoes?: number | null
  categoria: string
  cidade: string
  latitude?: number | null
  longitude?: number | null
  status?: string | null
  whatsapp?: string | null
  preco_ticket_inteira?: number | null
  preco_ticket_meia?: number | null
  preco_diaria?: number | null
  plano?: string | null
  palavras_chave?: unknown
  docs_verificado?: boolean | null
  somente_anfitriao?: boolean | null
  hospedagem_disponibilidade?: string | null
}

type OrdenacaoModo = 'avaliacao' | 'localizacao'

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export default function ListagemCategoriaPage() {
  const params = useParams()
  const router = useRouter()
  const slug = typeof params.categoria === 'string' ? params.categoria : params.categoria?.[0] ?? ''

  useEffect(() => {
    if (slug === 'compras') {
      router.replace('/compras-cde')
    }
  }, [slug, router])

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [planosResumo, setPlanosResumo] = useState<PlanoResumoServicos[]>([])
  const [degustacaoPlanoPorEmpresa, setDegustacaoPlanoPorEmpresa] = useState<Map<string, string | null>>(
    new Map(),
  )
  const [planoContratadoPorEmpresa, setPlanoContratadoPorEmpresa] = useState<Map<string, string>>(
    new Map(),
  )
  const [degustacaoCarregando, setDegustacaoCarregando] = useState(true)
  const [planosCarregando, setPlanosCarregando] = useState(true)
  /** Evita reocultar botões quando a lista de empresas atualiza (cache → rede). */
  const degustacaoJaResolvidaRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [erroLista, setErroLista] = useState('')
  const [pais, setPais] = useState<PaisGuiaFiltro>('br')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoModo>('avaliacao')
  const [geoCarregando, setGeoCarregando] = useState(false)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [termoBusca, setTermoBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [popupCheckAberto, setPopupCheckAberto] = useState(false)
  const [checkAtivo, setCheckAtivo] = useState(false)
  const [checkPesquisando, setCheckPesquisando] = useState(false)
  const [idsCheck, setIdsCheck] = useState<string[] | null>(null)
  const [precoMinCheck, setPrecoMinCheck] = useState<Record<string, number>>({})
  const [ordenarPrecoCheck, setOrdenarPrecoCheck] = useState(false)

  const ehPaginaHospedagem = slug === 'hospedagem'

  const categoriaDb = SLUG_CATEGORIA_EXTRA[slug] ?? categoriaDbPorSlugGuia(slug)
  const cidadeDb = useMemo(() => cidadeGuiaPorPais(pais), [pais])

  const cacheKey = useMemo(
    () => `guia:listagem:v3:${String(slug)}:${String(categoriaDb)}:${String(cidadeDb)}`,
    [slug, categoriaDb, cidadeDb]
  )

  const carregarEmpresas = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!silent) setLoading(true)
    if (!silent) setErroLista('')
    try {
      const { lista, error } = await buscarEmpresasListagemGuia(supabase, {
        categoria: categoriaDb,
        cidade: cidadeDb,
      })

      if (error) {
        setErroLista(error)
        setEmpresas([])
        return
      }
      setEmpresas(lista as Empresa[])
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), lista }))
      } catch {
        // ignore
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [categoriaDb, cidadeDb])

  useEffect(() => {
    let ativo = true
    const carregarPlanos = async () => {
      setPlanosCarregando(true)
      try {
        const { data } = await supabase.from('planos').select('id, nome, titulo, servicos').eq('ativo', true)
        if (!ativo) return
        const mapped = (data ?? []).map((row) => {
          const r = row as Record<string, unknown>
          const servicosRaw = r.servicos
          const servicos = Array.isArray(servicosRaw)
            ? servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
            : []
          return {
            id: r.id != null ? String(r.id) : undefined,
            nome: String(r.nome ?? ''),
            titulo: String(r.titulo ?? r.nome ?? ''),
            servicos,
          }
        })
        setPlanosResumo(mapped)
      } finally {
        if (ativo) setPlanosCarregando(false)
      }
    }
    void carregarPlanos()
    return () => {
      ativo = false
    }
  }, [])

  const empresaTemBotaoDinamico = useCallback(
    (empresa: Empresa) => {
      const emDegustacao = degustacaoPlanoPorEmpresa.has(empresa.id)
      const somenteAnfitriao = empresa.somente_anfitriao === true
      // Presença no guia já filtra ciclo irregular — não rebloqueia o botão por assinatura (evita flash).
      return empresaTemBotaoDinamicoPublico(
        empresa.plano,
        planosResumo,
        emDegustacao
          ? { ativa: true, planoId: degustacaoPlanoPorEmpresa.get(empresa.id) ?? null }
          : null,
        planoContratadoPorEmpresa.get(empresa.id) ?? null,
        { somenteAnfitriao },
      )
    },
    [degustacaoPlanoPorEmpresa, planoContratadoPorEmpresa, planosResumo],
  )

  useEffect(() => {
    degustacaoJaResolvidaRef.current = false
    setDegustacaoCarregando(true)
  }, [slug])

  useEffect(() => {
    if (empresas.length === 0) {
      setDegustacaoPlanoPorEmpresa(new Map())
      setPlanoContratadoPorEmpresa(new Map())
      if (!degustacaoJaResolvidaRef.current) setDegustacaoCarregando(false)
      return
    }
    let ativo = true
    if (!degustacaoJaResolvidaRef.current) setDegustacaoCarregando(true)
    void (async () => {
      const ids = empresas.map((e) => e.id)
      const [mapa, assRows] = await Promise.all([
        buscarMapaDegustacaoAtivaPorEmpresas(supabase, ids),
        buscarAssinaturasPresencaPublica(supabase, ids),
      ])
      const mapaPlano = new Map<string, string>()
      for (const row of assRows) {
        const empId = row.empresa_id
        const pid = row.plano_id
        const vigente = assinaturaContratadaVigente(row)
        if (!empId) continue
        if (pid && vigente) mapaPlano.set(empId, pid)
      }
      if (ativo) {
        setDegustacaoPlanoPorEmpresa(mapa)
        setPlanoContratadoPorEmpresa(mapaPlano)
        degustacaoJaResolvidaRef.current = true
        setDegustacaoCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [empresas])

  useEffect(() => {
    // FIX: cache rápido para volta instantânea
    let cacheFound = false
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        const lista = Array.isArray(parsed?.lista) ? parsed.lista : null
        if (lista) {
          setEmpresas(lista)
          setLoading(false)
          cacheFound = true
        }
      }
    } catch {
      // ignore
    }
    // FIX: no primeiro acesso (sem cache), não usar silent — evita render “vazio” até trocar filtro.
    void (cacheFound ? carregarEmpresas({ silent: true }) : carregarEmpresas())
  }, [carregarEmpresas, cacheKey])

  const empresasFiltradas = useMemo(() => {
    let base = empresas
    if (ehPaginaHospedagem && checkAtivo && idsCheck) {
      const setIds = new Set(idsCheck)
      base = base.filter((e) => setIds.has(e.id))
    }
    if (!termoBusca.trim()) return base
    return base.filter((e) => empresaCorrespondeBusca(e, termoBusca))
  }, [empresas, termoBusca, ehPaginaHospedagem, checkAtivo, idsCheck])

  const empresasOrdenadas = useMemo(() => {
    const base = [...empresasFiltradas]

    if (ehPaginaHospedagem && checkAtivo && ordenarPrecoCheck) {
      base.sort((a, b) => {
        const pa = precoMinCheck[a.id] ?? Infinity
        const pb = precoMinCheck[b.id] ?? Infinity
        if (pa !== pb) return pa - pb
        return (Number(b.nota_media) || 0) - (Number(a.nota_media) || 0)
      })
      return base
    }

    if (ordenacao === 'avaliacao') {
      base.sort((a, b) => {
        const na = Number(a.nota_media) || 0
        const nb = Number(b.nota_media) || 0
        if (nb !== na) return nb - na
        const ta = Number(a.total_avaliacoes) || 0
        const tb = Number(b.total_avaliacoes) || 0
        return tb - ta
      })
      return base
    }

    if (!userPos) return base
    base.sort((a, b) => {
      const alat = typeof a.latitude === 'number' ? a.latitude : a.latitude != null ? Number(a.latitude) : NaN
      const alng = typeof a.longitude === 'number' ? a.longitude : a.longitude != null ? Number(a.longitude) : NaN
      const blat = typeof b.latitude === 'number' ? b.latitude : b.latitude != null ? Number(b.latitude) : NaN
      const blng = typeof b.longitude === 'number' ? b.longitude : b.longitude != null ? Number(b.longitude) : NaN
      const ad = Number.isFinite(alat) && Number.isFinite(alng) ? haversineKm(userPos.lat, userPos.lng, alat, alng) : Infinity
      const bd = Number.isFinite(blat) && Number.isFinite(blng) ? haversineKm(userPos.lat, userPos.lng, blat, blng) : Infinity
      return ad - bd
    })
    return base
  }, [
    empresasFiltradas,
    ordenacao,
    userPos,
    ehPaginaHospedagem,
    checkAtivo,
    ordenarPrecoCheck,
    precoMinCheck,
  ])

  const aplicarQuestionarioCheck = useCallback(
    async (criterios: CriteriosFiltroHospedagemCheck) => {
      setCheckPesquisando(true)
      try {
        const resultado = await filtrarEmpresasPorQuestionarioHospedagem(
          supabase,
          empresas.map((e) => e.id),
          criterios,
        )
        setIdsCheck(resultado.empresaIds)
        setPrecoMinCheck(resultado.precoMinPorEmpresa)
        setOrdenarPrecoCheck(Boolean(criterios.ordenarPorPreco))
        setCheckAtivo(true)
        setPopupCheckAberto(false)
      } finally {
        setCheckPesquisando(false)
      }
    },
    [empresas],
  )

  const limparCheck = useCallback(() => {
    setCheckAtivo(false)
    setIdsCheck(null)
    setPrecoMinCheck({})
    setOrdenarPrecoCheck(false)
  }, [])

  const handleBuscar = useCallback(
    async (termo: string) => {
      setBuscando(true)
      try {
        if (termo) {
          await registrarBuscaGuia(slug, termo)
        }
        setTermoBusca(termo)
      } finally {
        setBuscando(false)
      }
    },
    [slug],
  )

  useEffect(() => {
    limparCheck()
  }, [pais, limparCheck])

  const titulo = TITULO_CATEGORIA_EXTRA[slug] ?? TITULO_SLUG_GUIA[slug] ?? slug
  const filtrosApoioCompactos = ehPaginaHospedagem
  const btnFiltroApoioBase = filtrosApoioCompactos
    ? 'inline-flex items-center justify-center rounded-none border bg-transparent p-1.5 transition'
    : 'inline-flex items-center justify-center rounded-none border bg-transparent p-2 transition'
  const btnFiltroApoioCls = (ativo: boolean) =>
    `${btnFiltroApoioBase} ${
      ativo ? 'border-2 border-white' : 'border border-white/70 hover:border-white'
    }`
  const iconFiltroApoioCls = filtrosApoioCompactos ? 'h-5 w-5 shrink-0 text-white' : 'h-6 w-6 shrink-0 text-white'
  const iconPinWrapCls = filtrosApoioCompactos
    ? 'relative inline-flex h-5 w-5 shrink-0 items-center justify-center'
    : 'relative inline-flex h-6 w-6 shrink-0 items-center justify-center'
  const strokeFiltro = (ativo: boolean) => (ativo ? 2.75 : 1.75)

  if (slug === 'compras') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Redirecionando para Compras CDE…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-white/20 bg-[#0097b2] pt-safe shadow-sm">
        <div className="flex flex-col gap-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <h1 className="min-w-0 truncate text-lg font-bold text-white">{titulo}</h1>
              <button
                type="button"
                onClick={() => setBuscaAberta((v) => !v)}
                className="shrink-0 rounded-full p-1 text-white transition hover:bg-white/15"
                aria-label={buscaAberta ? 'Ocultar busca' : 'Mostrar busca'}
                aria-expanded={buscaAberta}
              >
                <ChevronDown
                  size={22}
                  className={`transition-transform duration-200 ${buscaAberta ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              className="-mr-1 shrink-0 p-1"
              aria-label="Voltar"
            >
              <ArrowLeft size={22} className="text-white" />
            </button>
          </div>

          {buscaAberta ? (
            <div className="w-full">
              <BuscadorGuiaSegmento
                placeholder={`Buscar em ${titulo}…`}
                onBuscar={(t) => void handleBuscar(t)}
                buscando={buscando}
              />
            </div>
          ) : null}

          <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              {(
                [
                  { id: 'br' as const, emoji: '🇧🇷', alt: 'Brasil' },
                  { id: 'py' as const, emoji: '🇵🇾', alt: 'Paraguai' },
                  { id: 'ar' as const, emoji: '🇦🇷', alt: 'Argentina' },
                ] as const
              ).map((f) => {
                const ativo = pais === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPais(f.id)}
                    aria-label={f.alt}
                    className={`p-0.5 leading-none drop-shadow-[0_0_2px_white] transition ${
                      ativo ? 'scale-110 text-5xl' : 'scale-100 text-4xl'
                    }`}
                  >
                    <span aria-hidden>{f.emoji}</span>
                  </button>
                )
              })}
            </div>

            <div className={`flex shrink-0 items-center ${filtrosApoioCompactos ? 'gap-1' : 'gap-2'}`}>
              {ehPaginaHospedagem ? (
                <button
                  type="button"
                  title="Filtrar acomodações (Check)"
                  aria-label="Filtrar acomodações com questionário"
                  aria-pressed={checkAtivo}
                  onClick={() => setPopupCheckAberto(true)}
                  className={btnFiltroApoioCls(checkAtivo)}
                >
                  <Check
                    className={iconFiltroApoioCls}
                    fill={checkAtivo ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth={strokeFiltro(checkAtivo)}
                    aria-hidden
                  />
                </button>
              ) : null}

              <button
                type="button"
                title="Ordenar por avaliação"
                aria-label="Ordenar por avaliação"
                aria-pressed={ordenacao === 'avaliacao'}
                onClick={() => setOrdenacao('avaliacao')}
                className={btnFiltroApoioCls(ordenacao === 'avaliacao')}
              >
                <Star
                  className={iconFiltroApoioCls}
                  fill={ordenacao === 'avaliacao' ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={strokeFiltro(ordenacao === 'avaliacao')}
                  aria-hidden
                />
              </button>

              <button
                type="button"
                title="Ordenar por proximidade"
                aria-label="Ordenar por proximidade"
                aria-pressed={ordenacao === 'localizacao'}
                onClick={() => {
                  setOrdenacao('localizacao')
                  if (userPos || geoCarregando) return
                  if (typeof navigator === 'undefined' || !navigator.geolocation) {
                    window.alert('Geolocalização não disponível neste dispositivo.')
                    return
                  }
                  setGeoCarregando(true)
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                      setGeoCarregando(false)
                    },
                    () => {
                      window.alert('Não foi possível obter sua localização.')
                      setGeoCarregando(false)
                    },
                    { enableHighAccuracy: true, timeout: 8000 }
                  )
                }}
                className={btnFiltroApoioCls(ordenacao === 'localizacao')}
              >
                <span className={`${iconPinWrapCls} ${geoCarregando ? 'animate-pulse' : ''}`}>
                  <MapPin
                    className={iconFiltroApoioCls}
                    fill={ordenacao === 'localizacao' ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth={strokeFiltro(ordenacao === 'localizacao')}
                    aria-hidden
                  />
                  {ordenacao === 'localizacao' ? (
                    <span
                      className="pointer-events-none absolute left-1/2 top-[44%] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0097b2]"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4">
        {ehPaginaHospedagem && checkAtivo ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0097b2]/25 bg-[#0097b2]/5 px-3 py-2">
            <p className="text-xs font-semibold text-[#0097b2]">
              Filtro Check ativo
              {idsCheck ? ` · ${idsCheck.length} hospedagem(ns)` : ''}
            </p>
            <button
              type="button"
              onClick={limparCheck}
              className="text-xs font-bold text-[#001f3f] underline"
            >
              Limpar filtro
            </button>
          </div>
        ) : null}
        {erroLista ? <p className="mb-4 text-center text-sm font-medium text-red-600">{erroLista}</p> : null}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse text-gray-500">Carregando...</div>
          </div>
        ) : empresasFiltradas.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-400">
              {termoBusca.trim()
                ? 'Nenhuma empresa encontrada para este termo neste segmento'
                : ehPaginaHospedagem && checkAtivo
                  ? 'Nenhuma hospedagem combina com o questionário nesta região'
                  : 'Nenhuma empresa encontrada nesta região'}
            </p>
            {ehPaginaHospedagem && checkAtivo ? (
              <button
                type="button"
                onClick={() => {
                  limparCheck()
                  setPopupCheckAberto(true)
                }}
                className="mt-3 text-sm font-semibold text-[#0097b2] underline"
              >
                Refazer pesquisa
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {empresasOrdenadas.map((empresa) => (
              <CardAtrativo
                key={empresa.id}
                empresa={empresa}
                segmentoGuiaSlug={slug}
                temBotaoDinamico={empresaTemBotaoDinamico(empresa)}
                emDegustacao={degustacaoPlanoPorEmpresa.has(empresa.id)}
                planosCarregando={planosCarregando}
                degustacaoCarregando={degustacaoCarregando}
              />
            ))}
          </div>
        )}
      </div>

      {ehPaginaHospedagem ? (
        <PopupQuestionarioHospedagemCheck
          isOpen={popupCheckAberto}
          onClose={() => setPopupCheckAberto(false)}
          onPesquisar={(c) => void aplicarQuestionarioCheck(c)}
          onLimpar={limparCheck}
          filtroAtivo={checkAtivo}
          pesquisando={checkPesquisando}
        />
      ) : null}
    </div>
  )
}
