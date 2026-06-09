'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  agregarAtendimentosPorCategoria,
  agregarProfissionaisPorCategoria,
  agregarProfissionaisPorCidade,
  type AtendimentoMobilidadeRow,
} from '@/lib/mobilidadeRegional'
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
  seguimentosGuia: DadoBarras[] | null
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
  seguimentosGuia: null,
  mobilidadeCategorias: null,
  profissionaisPorCategoria: null,
  profissionaisPorCidade: null,
  empresasCidade: null,
  empresasSegmento: null,
}

const CORES_PIZZA_PADRAO = ['#0097b2', '#00D443', '#F1C40F', '#E74C3C', '#9B59B6', '#3498DB', '#E67E22', '#1ABC9C']
const CORES_ATIVOS_FAIXA = ['#0097b2', '#00D443', '#F1C40F']

type CreatedAtRow = { created_at: string | null }
type CategoriaRow = { categoria: string | null }
type CidadeRow = { cidade: string | null }
type LogCategoriaRow = { categoria: string | null }

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
        seguimentosGuia,
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
        perfil === 'turistas' ? fetchSeguimentosGuia(f) : Promise.resolve(null),
        perfil === 'turistas' ? fetchMobilidadeCategorias(f) : Promise.resolve(null),
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
        seguimentosGuia,
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

async function countUsuariosByRole(role: 'turista' | 'profissional', fromDate?: Date): Promise<number> {
  let q = supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('role', role)
  if (fromDate) q = q.gte('created_at', fromDate.toISOString())
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
      countUsuariosByRole('turista'),
      countUsuariosByRole('profissional'),
      countEmpresas(),
      countUsuariosByRole('turista', startCurrent),
      countUsuariosByRoleBetween('turista', startPrev, endPrev),
      countUsuariosByRole('profissional', startCurrent),
      countUsuariosByRoleBetween('profissional', startPrev, endPrev),
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
  const role = perfil === 'turistas' ? 'turista' : 'profissional'
  const { data, error } = await supabase
    .from('usuarios')
    .select('created_at')
    .eq('role', role)
    .gte('created_at', since.toISOString())
  if (error) throw error
  return groupByMonth(((data ?? []) as CreatedAtRow[]).map((r) => r.created_at).filter((v): v is string => Boolean(v)))
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
  // Proxy: sem last_active_at no schema atual, usamos recência de created_at em faixas exclusivas.
  if (perfil === 'empresas') {
    const { data, error } = await supabase.from('empresas').select('created_at')
    if (error) throw error
    return contarFaixasAtividade((data ?? []) as CreatedAtRow[])
  }

  const role = perfil === 'turistas' ? 'turista' : 'profissional'
  const { data, error } = await supabase.from('usuarios').select('created_at').eq('role', role)
  if (error) throw error
  return contarFaixasAtividade((data ?? []) as CreatedAtRow[])
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

  const role = perfil === 'turistas' ? 'turista' : 'profissional'
  const [atual, anterior] = await Promise.all([
    countUsuariosByRole(role, startCurrent),
    countUsuariosByRoleBetween(role, startPrev, endPrev),
  ])
  return { atual, anterior, variacao: calcVariacaoPercentual(atual, anterior) }
}

async function fetchMobilidadeCategorias(filtros: FiltrosVisaoGeral): Promise<DadoBarras[]> {
  const since = getPeriodoDate(filtros.periodo)
  const selectCompleto = `
    created_at,
    status,
    profissionais:profissional_id (categoria, categorias)
  `
  const { data, error } = await supabase
    .from('solicitacao_mobilidade')
    .select(selectCompleto)
    .gte('created_at', since.toISOString())

  if (!error && data && data.length > 0) {
    const rows: AtendimentoMobilidadeRow[] = []
    for (const row of data as Record<string, unknown>[]) {
      const prof = row.profissionais
      const profObj = prof && typeof prof === 'object' && !Array.isArray(prof) ? (prof as Record<string, unknown>) : null
      const categoria =
        (profObj?.categoria != null ? String(profObj.categoria) : '') ||
        (Array.isArray(profObj?.categorias) ? String((profObj.categorias as unknown[])[0] ?? '') : '') ||
        'outros'
      rows.push({
        categoria,
        cidades: [],
        createdAt: row.created_at != null ? String(row.created_at) : '',
        status: row.status != null ? String(row.status) : '',
      })
    }
    const agg = agregarAtendimentosPorCategoria(rows)
    return topN(
      agg.map((item) => ({ label: item.label, total: item.valor })),
      8,
    )
  }

  return [
    { label: 'Motoristas de App', total: 0 },
    { label: 'Motoristas de Van', total: 0 },
    { label: 'Taxistas', total: 0 },
    { label: 'Guias de Turismo', total: 0 },
    { label: 'Anfitriões', total: 0 },
  ]
}

async function fetchSeguimentosGuia(filtros: FiltrosVisaoGeral): Promise<DadoBarras[]> {
  // TODO: substituir fallback quando logs_cliques_categoria estiver populada em produção.
  const since = getPeriodoDate(filtros.periodo)
  const { data: logs, error } = await supabase
    .from('logs_cliques_categoria')
    .select('categoria')
    .gte('created_at', since.toISOString())

  if (!error && logs && logs.length > 0) {
    const map = new Map<string, number>()
    for (const row of logs as LogCategoriaRow[]) {
      const categoria = String(row.categoria ?? '')
      if (!categoria) continue
      map.set(categoria, (map.get(categoria) ?? 0) + 1)
    }
    return topN(
      Array.from(map.entries()).map(([key, total]) => ({
        label: getLabelCategoriaGuia(key),
        total,
      })),
      8
    )
  }

  return [
    { label: 'Gastronomia', total: 0 },
    { label: 'Lojas', total: 0 },
    { label: 'Hotelaria', total: 0 },
    { label: 'Passeios', total: 0 },
  ]
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
  const { data, error } = await supabase
    .from('profissionais')
    .select('categorias, cidade_atuacao, usuarios!profissionais_usuario_id_fkey(role)')
    .eq('usuarios.role', 'profissional')
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

async function countUsuariosByRoleBetween(role: 'turista' | 'profissional', fromDate: Date, toDate: Date): Promise<number> {
  const { count, error } = await supabase
    .from('usuarios')
    .select('*', { count: 'exact', head: true })
    .eq('role', role)
    .gte('created_at', fromDate.toISOString())
    .lte('created_at', toDate.toISOString())
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

function getLabelCategoriaGuia(categoria: string): string {
  const labels: Record<string, string> = {
    gastronomia: 'Gastronomia',
    lojas: 'Lojas',
    hotelaria: 'Hotelaria',
    passeios: 'Passeios',
    hospedagem: 'Hospedagem',
    servicos_locais: 'Serviços Locais',
  }
  return labels[categoria] ?? categoria
}

