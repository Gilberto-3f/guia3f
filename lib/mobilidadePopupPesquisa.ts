import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarCidadeTriplice, type CidadeTriplice } from '@/lib/mobilidadeRegional'
import {
  mapCidadeAtuacaoParaTabelado,
  mapRotaTabeladaRow,
  type CategoriaTabeladoId,
  type CidadeOrigemTabeladoId,
  type RotaTabelada,
} from '@/lib/servicosTabeladosCatalogo'
import type { MobilidadePonto } from '@/lib/mobilidadePesquisaParams'

/** Centros aproximados para inferir cidade pelo GPS. */
const CENTROS_TRIPLICE: { cidade: CidadeTriplice; lat: number; lng: number }[] = [
  { cidade: 'Foz do Iguaçu', lat: -25.5165, lng: -54.5855 },
  { cidade: 'Ciudad del Este', lat: -25.5097, lng: -54.6114 },
  { cidade: 'Puerto Iguazu', lat: -25.5972, lng: -54.5786 },
]

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h =
    s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function inferirCidadeTriplicePorCoords(lat: number, lng: number): CidadeTriplice {
  let best = CENTROS_TRIPLICE[0]
  let bestD = Infinity
  for (const c of CENTROS_TRIPLICE) {
    const d = haversineKm(lat, lng, c.lat, c.lng)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best.cidade
}

export function inferirCidadeDePonto(
  ponto: MobilidadePonto,
  fallbackTexto?: string | null,
): CidadeTriplice | null {
  if (ponto.lat != null && ponto.lng != null) {
    return inferirCidadeTriplicePorCoords(ponto.lat, ponto.lng)
  }
  return (
    normalizarCidadeTriplice(ponto.nome) ??
    normalizarCidadeTriplice(fallbackTexto) ??
    null
  )
}

export type ModalidadeMobilidadeId = 'motorista_app' | 'van' | 'taxista' | 'guia'

export const MODALIDADES_ORDEM: ModalidadeMobilidadeId[] = [
  'motorista_app',
  'van',
  'taxista',
  'guia',
]

export function ehCruzamentoFronteira(
  origem: CidadeTriplice | null,
  destino: CidadeTriplice | null,
): boolean {
  if (!origem || !destino) return false
  return origem !== destino
}

/** Modalidades visíveis: sem anfitrião; sem app se cruzar fronteira. Guia sempre na lista. */
export function modalidadesDisponiveis(cruzamentoFronteira: boolean): ModalidadeMobilidadeId[] {
  if (cruzamentoFronteira) {
    return ['van', 'taxista', 'guia']
  }
  return [...MODALIDADES_ORDEM]
}

/**
 * App sempre no topo (quando disponível); demais por preço menor→maior.
 * Sem preço → vai para o fim do grupo.
 */
export function ordenarModalidadesPorPreco(
  lista: ModalidadeMobilidadeId[],
  valores: Partial<Record<ModalidadeMobilidadeId, number | null>>,
): ModalidadeMobilidadeId[] {
  const app = lista.filter((id) => id === 'motorista_app')
  const resto = lista.filter((id) => id !== 'motorista_app')
  resto.sort((a, b) => {
    const va = valores[a]
    const vb = valores[b]
    const na = va != null && Number.isFinite(va) ? va : Number.POSITIVE_INFINITY
    const nb = vb != null && Number.isFinite(vb) ? vb : Number.POSITIVE_INFINITY
    if (na !== nb) return na - nb
    return MODALIDADES_ORDEM.indexOf(a) - MODALIDADES_ORDEM.indexOf(b)
  })
  return [...app, ...resto]
}

export function modalidadeRecomendada(
  cruzamentoFronteira: boolean,
  valores: Partial<Record<ModalidadeMobilidadeId, number | null>>,
): ModalidadeMobilidadeId {
  if (!cruzamentoFronteira) return 'motorista_app'
  const candidatas: ModalidadeMobilidadeId[] = ['van', 'taxista', 'guia']
  let best: ModalidadeMobilidadeId = 'taxista'
  let bestVal = Infinity
  for (const id of candidatas) {
    const v = valores[id]
    if (v != null && Number.isFinite(v) && v < bestVal) {
      bestVal = v
      best = id
    }
  }
  return best
}

function normTxt(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Escolhe a rota tabelada cujo destino mais se aproxima do texto informado. */
export function sugerirRotaParaDestino(
  rotas: RotaTabelada[],
  categoria: CategoriaTabeladoId,
  destinoTexto: string,
): RotaTabelada | null {
  const daCat = rotas.filter((r) => r.categoria === categoria && r.ativo)
  if (daCat.length === 0) return null
  const dest = normTxt(destinoTexto)
  if (!dest) return daCat[0] ?? null

  let best: RotaTabelada | null = null
  let bestScore = -1
  for (const r of daCat) {
    const df = normTxt(r.destinoFinal)
    let score = 0
    if (df === dest) score = 100
    else if (df.includes(dest) || dest.includes(df)) score = 80
    else {
      const tokens = dest.split(/\s+/).filter((t) => t.length > 2)
      score = tokens.reduce((acc, t) => (df.includes(t) ? acc + 10 : acc), 0)
    }
    if (score > bestScore) {
      bestScore = score
      best = r
    }
  }
  return best ?? daCat[0] ?? null
}

export async function carregarRotasTabeladasCidade(
  supabase: SupabaseClient,
  cidadeOrigem: CidadeOrigemTabeladoId,
): Promise<RotaTabelada[]> {
  const { data, error } = await supabase
    .from('servicos_tabelados_rotas')
    .select('*')
    .eq('ativo', true)
    .eq('cidade_origem', cidadeOrigem)

  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapRotaTabeladaRow)
}

export function cidadeTripliceParaTabelado(
  cidade: CidadeTriplice | null,
): CidadeOrigemTabeladoId | null {
  if (!cidade) return null
  return mapCidadeAtuacaoParaTabelado(cidade)
}

export type PagamentoMobilidadeId = 'pix' | 'dinheiro' | 'credito' | 'debito'

/** Ordem da lista no drawer 3 — a primeira é a marcada por padrão. */
export const PAGAMENTOS_ORDEM: PagamentoMobilidadeId[] = ['pix', 'dinheiro', 'credito', 'debito']

export const MOEDAS_MOBILIDADE = [
  { value: 'real', label: 'Real' },
  { value: 'guarani', label: 'Guaraní' },
  { value: 'peso', label: 'Peso' },
  { value: 'dolar', label: 'Dólar' },
  { value: 'euro', label: 'Euro' },
] as const

export type MoedaMobilidadeId = (typeof MOEDAS_MOBILIDADE)[number]['value']

export type SugestaoDestinoMobilidade = {
  id: string
  tipo: 'rota' | 'empresa'
  label: string
  detalhe: string | null
  lat: number | null
  lng: number | null
  empresaId: string | null
}

function scoreMatchTexto(haystack: string, query: string): number {
  const h = normTxt(haystack)
  const q = normTxt(query)
  if (!q || !h) return 0
  if (h === q) return 100
  if (h.startsWith(q)) return 90
  if (h.includes(q)) return 70
  const tokens = q.split(/\s+/).filter((t) => t.length > 1)
  if (tokens.length === 0) return 0
  return tokens.reduce((acc, t) => (h.includes(t) ? acc + 15 : acc), 0)
}

/**
 * Sugestões para o campo destino: destinos de rotas tabeladas + empresas do mapa.
 */
export function sugerirDestinosMobilidade(input: {
  query: string
  rotas: RotaTabelada[]
  empresas: {
    id: string
    nome_fantasia: string
    cidade?: string | null
    latitude?: number | null
    longitude?: number | null
  }[]
  limite?: number
}): SugestaoDestinoMobilidade[] {
  const q = String(input.query ?? '').trim()
  if (q.length < 2) return []
  const limite = input.limite ?? 8
  const out: (SugestaoDestinoMobilidade & { score: number })[] = []
  const destinosVistos = new Set<string>()

  for (const r of input.rotas) {
    if (!r.ativo) continue
    const label = String(r.destinoFinal ?? '').trim()
    if (!label) continue
    const key = `rota:${normTxt(label)}`
    if (destinosVistos.has(key)) continue
    const score = scoreMatchTexto(label, q)
    if (score <= 0) continue
    destinosVistos.add(key)
    out.push({
      id: key,
      tipo: 'rota',
      label,
      detalhe: null,
      lat: null,
      lng: null,
      empresaId: null,
      score,
    })
  }

  for (const e of input.empresas) {
    const label = String(e.nome_fantasia ?? '').trim()
    if (!label) continue
    const score = scoreMatchTexto(label, q)
    if (score <= 0) continue
    out.push({
      id: `empresa:${e.id}`,
      tipo: 'empresa',
      label,
      detalhe: e.cidade ? String(e.cidade) : null,
      lat: e.latitude != null && Number.isFinite(e.latitude) ? e.latitude : null,
      lng: e.longitude != null && Number.isFinite(e.longitude) ? e.longitude : null,
      empresaId: e.id,
      score,
    })
  }

  out.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'pt'))
  return out.slice(0, limite).map(({ score: _s, ...rest }) => rest)
}

/** Valor tabelado × lugares (van e guia). Demais modalidades: valor unitário. */
export function valorCorridaComLugares(
  modalidade: ModalidadeMobilidadeId,
  valorUnitario: number | null | undefined,
  lugares: number,
): number | null {
  if (valorUnitario == null || !Number.isFinite(valorUnitario)) return null
  const n = Math.max(1, Number(lugares) || 1)
  if (modalidade === 'van' || modalidade === 'guia') return valorUnitario * n
  return valorUnitario
}
