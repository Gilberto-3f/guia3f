'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buscarTopTermosGuia, type TopTermosSegmentoGuia } from '@/lib/buscasGuia'
import { agregarProfissionaisPorCategoria, agregarProfissionaisPorCidade } from '@/lib/mobilidadeRegional'
import type {
  DadoBarras,
  DadoCrescimento,
  DadoPizzaSegmento,
  DadoRosca,
  DadosTopoCards,
  FiltrosVisaoGeral,
  PerfilVisaoGeral,
} from '../types/admin.types'
import { calcVariacaoPercentual, getMesLabel, getPeriodoDate, topN } from '../utils/adminHelpers'

type UseAdminDataReturn = {
  topoCards: DadosTopoCards | null
  crescimento: DadoCrescimento[] | null
  ativos: DadoPizzaSegmento[] | null
  novosCadastros: DadoRosca | null
  topTermosGuia: TopTermosSegmentoGuia[] | null
  mobilidadeCategorias: DadoBarras[] | null
  profissionaisPorCategoria: DadoPizzaSegmento[] | null
  profissionaisPorCidade: DadoPizzaSegmento[] | null
  empresasCidade: DadoPizzaSegmento[] | null
  empresasSegmento: DadoPizzaSegmento[] | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

type DataState = Omit<UseAdminDataReturn, 'loading' | 'error' | 'refetch'>

const emptyData: DataState = {
  topoCards: null,
  crescimento: null,
  ativos: null,
  novosCadastros: null,
  topTermosGuia: null,
  mobilidadeCategorias: null,
  profissionaisPorCategoria: null,
  profissionaisPorCidade: null,
  empresasCidade: null,
  empresasSegmento: null,
}

const CORES_PIZZA_PADRAO = ['#0097b2', '#00D443', '#F1C40F', '#E74C3C', '#9B59B6', '#3498DB', '#E67E22', '#1ABC9C']
const CORES_ATIVOS_FAIXA = ['#0097b2', '#00D443', '#F1C40F']

/** Mobilidade ainda não conectada — estrutura fixa com totais zerados. */
const MOBILIDADE_PLACEHOLDER: DadoBarras[] = [
  { label: 'Motoristas de App', total: 0 },
  { label: 'Motoristas de Van', total: 0 },
  { label: 'Taxistas', total: 0 },
  { label: 'Guias de Turismo', total: 0 },
  { label: 'Anfitriões', total: 0 },
]

function faixasAtivosVazias(): DadoPizzaSegmento[] {
  return [
    { label: '24 horas', valor: 0, percentual: 0, cor: CORES_ATIVOS_FAIXA[0] },
    { label: '48 horas', valor: 0, percentual: 0, cor: CORES_ATIVOS_FAIXA[1] },
    { label: '72 horas', valor: 0, percentual: 0, cor: CORES_ATIVOS_FAIXA[2] },
  ]
}

type CreatedAtRow = { created_at: string | null }
type CategoriaRow = { categoria: string | null }
type CidadeRow = { cidade: string | null }
function createdAtPerfilRow(row: Record<string, unknown>): string | null {
  const direto = row.created_at
  if (typeof direto === 'string' && direto) return direto
  const usuarios = row.usuarios
  if (usuarios && typeof usuarios === 'object' && !Array.isArray(usuarios)) {
    const nested = (usuarios as { created_at?: unknown }).created_at
    if (typeof nested === 'string' && nested) return nested
  }
  if (Array.isArray(usuarios) && usuarios[0] && typeof usuarios[0] === 'object') {
    const nested = (usuarios[0] as { created_at?: unknown }).created_at
    if (typeof nested === 'string' && nested) return nested
  }
  return null
}

/** Quando `loadTopoCards` é false (padrão), não busca totais — em `TopoCards` passe `{ loadTopoCards: true }` para evitar pedidos duplicados ao trocar subabas na Visão Geral. */
export type UseAdminDataOptions = {
  loadTopoCards?: boolean
}

export function useAdminData(
  perfil: PerfilVisaoGeral,
  filtros: FiltrosVisaoGeral,
  options?: UseAdminDataOptions
): UseAdminDataReturn {
  const loadTopoCards = options?.loadTopoCards === true

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<DataState>(emptyData)

  const filtrosRef = useRef(filtros)
  filtrosRef.current = filtros

  /** Evita aplicar resultado de fetch antigo se perfil/período mudou (sem polling; só corridas raras). */
  const fetchGenerationRef = useRef(0)

  const fetchData = useCallback(async () => {
    const f = filtrosRef.current
    const myGen = ++fetchGenerationRef.current
    setError(null)
    try {
      const [
        topoCards,
        crescimento,
        ativos,
        novosCadastros,
        topTermosGuia,
        mobilidadeCategorias,
        profissionaisPorCategoria,
        profissionaisPorCidade,
        empresasCidade,
        empresasSegmento,
      ] = await Promise.all([
        loadTopoCards ? fetchTopoCards() : Promise.resolve(null),
        fetchCrescimento(perfil, f),
        fetchAtivosFaixas(perfil),
        fetchNovosCadastros(perfil),
        perfil === 'turistas' ? fetchTopTermosGuia(f) : Promise.resolve(null),
        perfil === 'turistas' ? fetchMobilidadeCategorias() : Promise.resolve(null),
        perfil === 'profissionais' ? fetchProfissionaisDistribuicaoCategoria() : Promise.resolve(null),
        perfil === 'profissionais' ? fetchProfissionaisDistribuicaoCidade() : Promise.resolve(null),
        perfil === 'empresas' ? fetchEmpresasDistribuicaoCidade() : Promise.resolve(null),
        perfil === 'empresas' ? fetchEmpresasDistribuicaoSegmento() : Promise.resolve(null),
      ])

      if (myGen !== fetchGenerationRef.current) return

      setData({
        topoCards,
        crescimento,
        ativos,
        novosCadastros,
        topTermosGuia,
        mobilidadeCategorias,
        profissionaisPorCategoria,
        profissionaisPorCidade,
        empresasCidade,
        empresasSegmento,
      })
    } catch (err) {
      if (myGen !== fetchGenerationRef.current) return
      setError(err instanceof Error ? err : new Error('Erro ao carregar dados da visão geral'))
    } finally {
      if (myGen === fetchGenerationRef.current) setLoading(false)
    }
  }, [perfil, loadTopoCards])

  useEffect(() => {
    void fetchData()
  }, [perfil, fetchData, filtros.periodo])

  return { ...data, loading, error, refetch: fetchData }
}

type TabelaPerfilCadastro = 'turistas' | 'profissionais'

async function countPerfisCadastro(
  tabela: TabelaPerfilCadastro,
  fromDate?: Date,
  toDate?: Date,
): Promise<number> {
  let q = supabase.from(tabela).select('*', { count: 'exact', head: true })
  if (fromDate) q = q.gte('created_at', fromDate.toISOString())
  if (toDate) q = q.lte('created_at', toDate.toISOString())
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

async function fetchTopoCards(): Promise<DadosTopoCards> {
  const startCurrent = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const startPrev = new Date(startCurrent)
  startPrev.setMonth(startPrev.getMonth() - 1)
  const endPrev = new Date(startCurrent.getTime() - 1)

  const [turistasTotal, profissionaisTotal, empresasTotal, turistasAtual, turistasAnterior, profissionaisAtual, profissionaisAnterior, empresasAtual, empresasAnterior] =
    await Promise.all([
      countPerfisCadastro('turistas'),
      countPerfisCadastro('profissionais'),
      countEmpresas(),
      countPerfisCadastro('turistas', startCurrent),
      countPerfisCadastro('turistas', startPrev, endPrev),
      countPerfisCadastro('profissionais', startCurrent),
      countPerfisCadastro('profissionais', startPrev, endPrev),
      countEmpresas(startCurrent),
      countEmpresas(startPrev, endPrev),
    ])

  return {
    turistas: {
      total: turistasTotal,
      variacao: calcVariacaoPercentual(turistasAtual, turistasAnterior),
    },
    profissionais: {
      total: profissionaisTotal,
      variacao: calcVariacaoPercentual(profissionaisAtual, profissionaisAnterior),
    },
    empresas: {
      total: empresasTotal,
      variacao: calcVariacaoPercentual(empresasAtual, empresasAnterior),
    },
  }
}

async function fetchCrescimento(perfil: PerfilVisaoGeral, filtros: FiltrosVisaoGeral): Promise<DadoCrescimento[]> {
  const since = getPeriodoDate(filtros.periodo)
  if (perfil === 'empresas') {
    const { data, error } = await supabase.from('empresas').select('created_at').gte('created_at', since.toISOString())
    if (error) throw error
    return groupByMonth(((data ?? []) as CreatedAtRow[]).map((r) => r.created_at).filter((v): v is string => Boolean(v)))
  }
  const tabela: TabelaPerfilCadastro = perfil === 'turistas' ? 'turistas' : 'profissionais'
  const { data, error } = await supabase.from(tabela).select('created_at')
  if (error) throw error
  const datas = (data ?? [])
    .map((r) => createdAtPerfilRow(r as Record<string, unknown>))
    .filter((v): v is string => {
      if (!v) return false
      const t = new Date(v).getTime()
      return !Number.isNaN(t) && t >= since.getTime()
    })
  return groupByMonth(datas)
}

function contarFaixasAtividade(rows: CreatedAtRow[]): DadoPizzaSegmento[] {
  const now = Date.now()
  const ms24 = 24 * 60 * 60 * 1000
  const ms48 = 48 * 60 * 60 * 1000
  const ms72 = 72 * 60 * 60 * 1000

  let faixa24 = 0
  let faixa48 = 0
  let faixa72 = 0

  for (const row of rows) {
    const iso = row.created_at
    if (!iso) continue
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) continue
    const diff = now - t
    if (diff <= ms24) faixa24 += 1
    else if (diff <= ms48) faixa48 += 1
    else if (diff <= ms72) faixa72 += 1
  }

  const faixas = [
    { label: '24 horas', valor: faixa24 },
    { label: '48 horas', valor: faixa48 },
    { label: '72 horas', valor: faixa72 },
  ]
  const total = faixas.reduce((s, f) => s + f.valor, 0)

  return faixas.map((f, i) => ({
    ...f,
    percentual: total > 0 ? (f.valor / total) * 100 : 0,
    cor: CORES_ATIVOS_FAIXA[i],
  }))
}

async function fetchAtivosFaixas(perfil: PerfilVisaoGeral): Promise<DadoPizzaSegmento[]> {
  if (perfil === 'empresas') {
    const { data, error } = await supabase.from('empresas').select('created_at')
    if (error) throw error
    return contarFaixasAtividade((data ?? []) as CreatedAtRow[])
  }

  const perfilParam = perfil === 'turistas' ? 'turistas' : 'profissionais'
  try {
    const res = await fetch(`/api/admin/visao-geral/ativos?perfil=${perfilParam}`, { credentials: 'include' })
    if (!res.ok) return faixasAtivosVazias()
    const body = (await res.json()) as { faixas?: DadoPizzaSegmento[] }
    return body.faixas?.length ? body.faixas : faixasAtivosVazias()
  } catch {
    return faixasAtivosVazias()
  }
}

async function fetchNovosCadastros(perfil: PerfilVisaoGeral): Promise<DadoRosca> {
  const startCurrent = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const startPrev = new Date(startCurrent)
  startPrev.setMonth(startPrev.getMonth() - 1)
  const endPrev = new Date(startCurrent.getTime() - 1)

  if (perfil === 'empresas') {
    const [atual, anterior] = await Promise.all([
      countEmpresas(startCurrent),
      countEmpresas(startPrev, endPrev),
    ])
    return { atual, anterior, variacao: calcVariacaoPercentual(atual, anterior) }
  }

  const tabela: TabelaPerfilCadastro = perfil === 'turistas' ? 'turistas' : 'profissionais'
  const [atual, anterior] = await Promise.all([
    countPerfisCadastro(tabela, startCurrent),
    countPerfisCadastro(tabela, startPrev, endPrev),
  ])
  return { atual, anterior, variacao: calcVariacaoPercentual(atual, anterior) }
}

async function fetchMobilidadeCategorias(): Promise<DadoBarras[]> {
  return MOBILIDADE_PLACEHOLDER
}

async function fetchTopTermosGuia(filtros: FiltrosVisaoGeral): Promise<TopTermosSegmentoGuia[]> {
  const since = getPeriodoDate(filtros.periodo)
  try {
    return await buscarTopTermosGuia(since.toISOString(), 10)
  } catch {
    return []
  }
}

function barrasParaPizza(dados: DadoBarras[]): DadoPizzaSegmento[] {
  const total = dados.reduce((s, d) => s + d.total, 0)
  return dados.map((d, i) => ({
    label: d.label,
    valor: d.total,
    percentual: total > 0 ? (d.total / total) * 100 : 0,
    cor: CORES_PIZZA_PADRAO[i % CORES_PIZZA_PADRAO.length],
  }))
}

async function fetchProfissionaisMobilidadeRows() {
  const { data, error } = await supabase.from('profissionais').select('categorias, cidade_atuacao')
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return { categorias: row.categorias, cidade_atuacao: row.cidade_atuacao }
  })
}

async function fetchProfissionaisDistribuicaoCategoria(): Promise<DadoPizzaSegmento[]> {
  const rows = await fetchProfissionaisMobilidadeRows()
  return agregarProfissionaisPorCategoria(rows).map((item) => ({
    label: item.label,
    valor: item.valor,
    percentual: item.percentual,
    cor: item.cor,
  }))
}

async function fetchProfissionaisDistribuicaoCidade(): Promise<DadoPizzaSegmento[]> {
  const rows = await fetchProfissionaisMobilidadeRows()
  return agregarProfissionaisPorCidade(rows).map((item) => ({
    label: item.label,
    valor: item.valor,
    percentual: item.percentual,
    cor: item.cor,
  }))
}

async function fetchEmpresasDistribuicaoCidade(): Promise<DadoPizzaSegmento[]> {
  const { data, error } = await supabase.from('empresas').select('cidade')
  if (error) throw error
  const map = new Map<string, number>()
  for (const row of (data ?? []) as CidadeRow[]) {
    const key = String(row.cidade ?? 'Sem cidade')
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return barrasParaPizza(topN(Array.from(map.entries()).map(([label, total]) => ({ label, total })), 8))
}

async function fetchEmpresasDistribuicaoSegmento(): Promise<DadoPizzaSegmento[]> {
  const { data, error } = await supabase.from('empresas').select('categoria')
  if (error) throw error
  const map = new Map<string, number>()
  for (const row of (data ?? []) as CategoriaRow[]) {
    const key = String(row.categoria ?? 'Sem categoria')
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return barrasParaPizza(topN(Array.from(map.entries()).map(([label, total]) => ({ label, total })), 8))
}

async function countEmpresas(fromDate?: Date, toDate?: Date): Promise<number> {
  let q = supabase.from('empresas').select('*', { count: 'exact', head: true })
  if (fromDate) q = q.gte('created_at', fromDate.toISOString())
  if (toDate) q = q.lte('created_at', toDate.toISOString())
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

function groupByMonth(createdAts: string[]): DadoCrescimento[] {
  const map = new Map<string, number>()
  for (const iso of createdAts) {
    const d = new Date(iso)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => ({
      mes: getMesLabel(`${key}-01T00:00:00.000Z`),
      total,
    }))
}

