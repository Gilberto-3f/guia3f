'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CardAtrativo from '@/components/CardAtrativo'
import BuscadorGuiaSegmento from '@/components/guia/BuscadorGuiaSegmento'
import { empresaCorrespondeBusca } from '@/lib/palavrasChaveGuia'
import { registrarBuscaGuia } from '@/lib/buscasGuia'
import {
  empresaTemServico,
  resolverServicosEmpresaComDegustacao,
  type PlanoResumoServicos,
} from '@/lib/planosEmpresaServicosGate'
import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'
import { buscarMapaDegustacaoAtivaPorEmpresas } from '@/lib/degustacaoEmpresa'
import { aplicarFiltroEmpresasGuiaPublico } from '@/lib/empresaGuiaVisibilidade'

import { slugGuiaParaCategoriaDb } from '@/lib/segmentosEmpresaGuia'

/** Slug da URL (GradeFiltros) → valor de empresas.categoria no cadastro */
const SLUG_PARA_CATEGORIA_DB: Record<string, string> = {
  gastronomia: 'Restaurantes',
  passeios: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
  servicos_locais: 'Serviços Locais',
  compras: 'Compras Paraguai',
  eventos: 'Eventos',
  mobilidade: 'Mobilidade',
}

// FIX: apenas 3 filtros fixos (bandeiras)
type PaisFiltro = 'br' | 'py' | 'ar'

// FIX: bandeira → empresas.cidade no cadastro
// Observação: mantemos os nomes já usados no projeto para compatibilidade.
const CIDADE_POR_PAIS: Record<PaisFiltro, string> = {
  br: 'Foz do Iguaçu',
  py: 'Ciudad del Este',
  ar: 'Puerto Iguazu',
}

const TITULO_CATEGORIA: Record<string, string> = {
  gastronomia: 'Gastronomia',
  passeios: 'Passeios',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
  servicos_locais: 'Serviços Locais',
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

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [planosResumo, setPlanosResumo] = useState<PlanoResumoServicos[]>([])
  const [degustacaoPlanoPorEmpresa, setDegustacaoPlanoPorEmpresa] = useState<Map<string, string | null>>(
    new Map(),
  )
  const [planosCarregando, setPlanosCarregando] = useState(true)
  const [loading, setLoading] = useState(true)
  const [erroLista, setErroLista] = useState('')
  const [pais, setPais] = useState<PaisFiltro>('br')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoModo>('avaliacao')
  const [geoCarregando, setGeoCarregando] = useState(false)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [termoBusca, setTermoBusca] = useState('')
  const [buscando, setBuscando] = useState(false)

  const categoriaDb = SLUG_PARA_CATEGORIA_DB[slug] ?? slugGuiaParaCategoriaDb(slug) ?? slug
  const cidadeDb = useMemo(() => CIDADE_POR_PAIS[pais], [pais])

  const cacheKey = useMemo(
    () => `guia:listagem:v2:${String(slug)}:${String(categoriaDb)}:${String(cidadeDb)}`,
    [slug, categoriaDb, cidadeDb]
  )

  const carregarEmpresas = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!silent) setLoading(true)
    if (!silent) setErroLista('')
    try {
      const { data: empresasData, error } = await aplicarFiltroEmpresasGuiaPublico(
        supabase
          .from('empresas')
          .select(
            'id, nome_fantasia, nome_usuario, descricao_curta, categoria, cidade, endereco, bairro, status, docs_verificado, nota_media, total_avaliacoes, latitude, longitude, foto_url, whatsapp, preco_ticket_inteira, preco_ticket_meia, preco_diaria, palavras_chave, plano'
          )
          .eq('categoria', categoriaDb)
          .eq('cidade', cidadeDb),
      )
        .order('nota_media', { ascending: false })
        .order('total_avaliacoes', { ascending: false })

      if (error) {
        const msg = String(error.message ?? '').toLowerCase()
        if (msg.includes('palavras_chave') && (msg.includes('column') || msg.includes('does not exist'))) {
          const retry = await aplicarFiltroEmpresasGuiaPublico(
            supabase
              .from('empresas')
              .select(
                'id, nome_fantasia, nome_usuario, descricao_curta, categoria, cidade, endereco, bairro, status, docs_verificado, nota_media, total_avaliacoes, latitude, longitude, foto_url, whatsapp, preco_ticket_inteira, preco_ticket_meia, preco_diaria'
              )
              .eq('categoria', categoriaDb)
              .eq('cidade', cidadeDb),
          )
            .order('nota_media', { ascending: false })
            .order('total_avaliacoes', { ascending: false })
          if (!retry.error) {
            setEmpresas((retry.data ?? []) as Empresa[])
            return
          }
        }
        setErroLista(error.message)
        setEmpresas([])
        return
      }
      const lista = (empresasData ?? []) as Empresa[]
      setEmpresas(lista)
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
      const degPlanoId = degustacaoPlanoPorEmpresa.get(empresa.id) ?? null
      const servicos = resolverServicosEmpresaComDegustacao(empresa.plano, planosResumo, degPlanoId)
      return empresaTemServico(servicos, 'botao_dinamico')
    },
    [degustacaoPlanoPorEmpresa, planosResumo],
  )

  useEffect(() => {
    if (empresas.length === 0) {
      setDegustacaoPlanoPorEmpresa(new Map())
      return
    }
    let ativo = true
    void (async () => {
      const mapa = await buscarMapaDegustacaoAtivaPorEmpresas(
        supabase,
        empresas.map((e) => e.id),
      )
      if (ativo) setDegustacaoPlanoPorEmpresa(mapa)
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
    if (!termoBusca.trim()) return empresas
    return empresas.filter((e) => empresaCorrespondeBusca(e, termoBusca))
  }, [empresas, termoBusca])

  const empresasOrdenadas = useMemo(() => {
    const base = [...empresasFiltradas]
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
  }, [empresasFiltradas, ordenacao, userPos])

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

  const titulo = TITULO_CATEGORIA[slug] ?? slug

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-white/20 bg-[#0097b2] pt-safe shadow-sm">
        <div className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => router.back()} className="-ml-1 shrink-0 p-1" aria-label="Voltar">
              <ArrowLeft size={22} className="text-white" />
            </button>
            <h1 className="truncate text-lg font-bold text-white">{titulo}</h1>
          </div>

          <div className="w-full sm:max-w-xl">
            <BuscadorGuiaSegmento
              placeholder={`Buscar em ${titulo}…`}
              onBuscar={(t) => void handleBuscar(t)}
              buscando={buscando}
            />
          </div>

          <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2 sm:flex-1">
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

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                title="Ordenar por avaliação"
                aria-label="Ordenar por avaliação"
                onClick={() => setOrdenacao('avaliacao')}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 transition hover:bg-gray-50"
              >
                <Star
                  className="h-6 w-6 shrink-0 text-[#0097b2]"
                  fill={ordenacao === 'avaliacao' ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  aria-hidden
                />
              </button>

              <button
                type="button"
                title="Ordenar por proximidade"
                aria-label="Ordenar por proximidade"
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
                className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 transition hover:bg-gray-50"
              >
                <span
                  className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center ${geoCarregando ? 'animate-pulse' : ''}`}
                >
                  <MapPin
                    className="h-6 w-6 text-[#0097b2]"
                    fill={ordenacao === 'localizacao' ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    aria-hidden
                  />
                  {ordenacao === 'localizacao' ? (
                    <span
                      className="pointer-events-none absolute left-1/2 top-[44%] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
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
                : 'Nenhuma empresa encontrada nesta região'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {empresasOrdenadas.map((empresa) => (
              <CardAtrativo
                key={empresa.id}
                empresa={empresa}
                segmentoGuiaSlug={slug}
                temBotaoDinamico={empresaTemBotaoDinamico(empresa)}
                planosCarregando={planosCarregando}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
