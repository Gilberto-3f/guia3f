'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CardAtrativo from '@/components/CardAtrativo'

/** Slug da URL (GradeFiltros) → valor de empresas.categoria no cadastro */
const SLUG_PARA_CATEGORIA_DB: Record<string, string> = {
  gastronomia: 'Restaurantes',
  passeios: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
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
  const [loading, setLoading] = useState(true)
  const [erroLista, setErroLista] = useState('')
  const [pais, setPais] = useState<PaisFiltro>('br')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoModo>('avaliacao')
  const [geoCarregando, setGeoCarregando] = useState(false)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

  const categoriaDb = SLUG_PARA_CATEGORIA_DB[slug] ?? slug
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
      const { data: empresasData, error } = await supabase
        .from('empresas')
        // FIX: seleciona só o necessário (melhor para tsc/typing e rede)
        .select(
          'id, nome_fantasia, nome_usuario, descricao_curta, categoria, cidade, status, nota_media, total_avaliacoes, latitude, longitude, foto_url, whatsapp, preco_ticket_inteira, preco_ticket_meia, preco_diaria'
        )
        .eq('categoria', categoriaDb)
        .eq('cidade', cidadeDb)
        // FIX: apenas aprovadas
        .eq('status', 'aprovado')
        // FIX: exibir apenas com foto
        .not('foto_url', 'is', null)
        // FIX: melhores avaliados primeiro + desempate por total de avaliações (quando disponível)
        .order('nota_media', { ascending: false })
        .order('total_avaliacoes', { ascending: false })

      if (error) {
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

  const empresasOrdenadas = useMemo(() => {
    const base = [...empresas]
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
  }, [empresas, ordenacao, userPos])

  const titulo = TITULO_CATEGORIA[slug] ?? slug

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-white/20 bg-[#0097b2] shadow-sm">
        <div className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => router.back()} className="-ml-1 shrink-0 p-1" aria-label="Voltar">
              <ArrowLeft size={22} className="text-white" />
            </button>
            <h1 className="truncate text-lg font-bold text-white">{titulo}</h1>
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-12 gap-y-2 sm:flex-1">
            <div className="flex items-center gap-3">
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
                    className={`p-0.5 text-4xl leading-none drop-shadow-[0_0_2px_white] transition ${
                      ativo ? 'scale-110 opacity-100' : 'scale-100 opacity-60 hover:opacity-80'
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
        ) : empresas.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-400">Nenhuma empresa encontrada nesta região</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {empresasOrdenadas.map((empresa) => (
              <CardAtrativo key={empresa.id} empresa={empresa} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
