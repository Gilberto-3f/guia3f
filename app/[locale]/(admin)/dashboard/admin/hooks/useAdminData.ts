'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  DadoAtivo,
  DadoBarras,
  DadoCrescimento,
  DadoRosca,
  DadosTopoCards,
  FiltrosVisaoGeral,
  PerfilVisaoGeral,
} from '../types/admin.types'
import { calcVariacaoPercentual, getMesLabel, getPeriodoDate, topN } from '../utils/adminHelpers'

type UseAdminDataReturn = {
  topoCards: DadosTopoCards | null
  crescimento: DadoCrescimento[] | null
  ativos: DadoAtivo[] | null
  novosCadastros: DadoRosca | null
  servicosMaisUsados: DadoBarras[] | null
  maisUsadosGuia: DadoBarras[] | null
  profissionaisCidade: DadoBarras[] | null
  profissionaisCategoria: DadoBarras[] | null
  empresasCidade: DadoBarras[] | null
  empresasSegmento: DadoBarras[] | null
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
  servicosMaisUsados: null,
  maisUsadosGuia: null,
  profissionaisCidade: null,
  profissionaisCategoria: null,
  empresasCidade: null,
  empresasSegmento: null,
}

type CreatedAtRow = { created_at: string | null }
type CategoriaRow = { categoria: string | null }
type CidadeRow = { cidade: string | null }
type ProfCategoriasRow = { categorias: string[] | null }
type ProfCidadeAtuacaoRow = { cidade_atuacao: string[] | null }
type LogServicoRow = { servico: string | null }
type LogCategoriaRow = { categoria: string | null }

export function useAdminData(perfil: PerfilVisaoGeral, filtros: FiltrosVisaoGeral): UseAdminDataReturn {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<DataState>(emptyData)

  const filtrosRef = useRef(filtros)

  useEffect(() => {
    filtrosRef.current = filtros
  }, [filtros])

  const fetchData = useCallback(async () => {
    const f = filtrosRef.current
    setLoading(true)
    setError(null)
    try {
      const [
        topoCards,
        crescimento,
        ativos,
        novosCadastros,
        servicosMaisUsados,
        maisUsadosGuia,
        profissionaisCidade,
        profissionaisCategoria,
        empresasCidade,
        empresasSegmento,
      ] = await Promise.all([
        fetchTopoCards(),
        fetchCrescimento(perfil, f),
        fetchAtivos(perfil),
        fetchNovosCadastros(perfil),
        perfil === 'turistas' ? fetchServicosMaisUsados(f) : Promise.resolve(null),
        perfil === 'turistas' ? fetchMaisUsadosGuia(f) : Promise.resolve(null),
        perfil === 'profissionais' ? fetchProfissionaisCidade() : Promise.resolve(null),
        perfil === 'profissionais' ? fetchProfissionaisCategoria() : Promise.resolve(null),
        perfil === 'empresas' ? fetchEmpresasCidade() : Promise.resolve(null),
        perfil === 'empresas' ? fetchEmpresasSegmento() : Promise.resolve(null),
      ])

      setData({
        topoCards,
        crescimento,
        ativos,
        novosCadastros,
        servicosMaisUsados,
        maisUsadosGuia,
        profissionaisCidade,
        profissionaisCategoria,
        empresasCidade,
        empresasSegmento,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar dados da visão geral'))
    } finally {
      setLoading(false)
    }
  }, [perfil])

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

async function fetchAtivos(perfil: PerfilVisaoGeral): Promise<DadoAtivo[]> {
  // Proxy temporario: sem last_active_at no schema atual, usamos recencia de created_at.
  const limite = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  if (perfil === 'empresas') {
    const { data, error } = await supabase.from('empresas').select('created_at')
    if (error) throw error
    const base = (data ?? []) as CreatedAtRow[]
    const ativos = base.filter((r) => (r.created_at ?? '') >= limite).length
    return [
      { status: 'ativo', total: ativos },
      { status: 'offline', total: Math.max(base.length - ativos, 0) },
    ]
  }
  const role = perfil === 'turistas' ? 'turista' : 'profissional'
  const { data, error } = await supabase.from('usuarios').select('created_at').eq('role', role)
  if (error) throw error
  const base = (data ?? []) as CreatedAtRow[]
  const ativos = base.filter((r) => (r.created_at ?? '') >= limite).length
  return [
    { status: 'ativo', total: ativos },
    { status: 'offline', total: Math.max(base.length - ativos, 0) },
  ]
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

async function fetchServicosMaisUsados(filtros: FiltrosVisaoGeral): Promise<DadoBarras[]> {
  // TODO: substituir fallback quando logs_acessos estiver populada em produção.
  const since = getPeriodoDate(filtros.periodo)
  const { data: logs, error } = await supabase
    .from('logs_acessos')
    .select('servico')
    .gte('created_at', since.toISOString())

  if (!error && logs && logs.length > 0) {
    const map = new Map<string, number>()
    for (const row of logs as LogServicoRow[]) {
      const servico = String(row.servico ?? '')
      if (!servico) continue
      map.set(servico, (map.get(servico) ?? 0) + 1)
    }
    return topN(
      Array.from(map.entries()).map(([key, total]) => ({
        label: getLabelServico(key),
        total,
      })),
      8
    )
  }

  return [
    { label: 'Mobilidade', total: 0 },
    { label: 'Rede Social', total: 0 },
    { label: 'Guia', total: 0 },
    { label: 'Compras', total: 0 },
  ]
}

async function fetchMaisUsadosGuia(filtros: FiltrosVisaoGeral): Promise<DadoBarras[]> {
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

async function fetchProfissionaisCidade(): Promise<DadoBarras[]> {
  // TODO: quando cidade_atuacao estiver em todos os registros, remover fallback zerado.
  const { data, error } = await supabase.from('profissionais').select('cidade_atuacao')
  if (!error && data && data.length > 0) {
    const map = new Map<string, number>()
    let hasCidadeAtuacao = false

    for (const row of data as ProfCidadeAtuacaoRow[]) {
      const cidades = row.cidade_atuacao
      if (Array.isArray(cidades) && cidades.length > 0) {
        hasCidadeAtuacao = true
        for (const cidade of cidades) {
          const label = String(cidade)
          if (!label) continue
          map.set(label, (map.get(label) ?? 0) + 1)
        }
      }
    }

    if (hasCidadeAtuacao && map.size > 0) {
      return topN(Array.from(map.entries()).map(([label, total]) => ({ label, total })), 8)
    }
  }

  return [
    { label: 'Foz do Iguacu', total: 0 },
    { label: 'Ciudad del Este', total: 0 },
    { label: 'Puerto Iguazu', total: 0 },
  ]
}

async function fetchProfissionaisCategoria(): Promise<DadoBarras[]> {
  const { data, error } = await supabase.from('profissionais').select('categorias')
  if (error) throw error
  const map = new Map<string, number>()
  for (const row of (data ?? []) as ProfCategoriasRow[]) {
    const categorias = Array.isArray(row.categorias) ? row.categorias : []
    for (const c of categorias) {
      const key = String(c)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  }
  return topN(Array.from(map.entries()).map(([label, total]) => ({ label, total })), 8)
}

async function fetchEmpresasCidade(): Promise<DadoBarras[]> {
  const { data, error } = await supabase.from('empresas').select('cidade')
  if (error || !data || data.length === 0) {
    return [
      { label: 'Foz do Iguacu', total: 0 },
      { label: 'Ciudad del Este', total: 0 },
      { label: 'Puerto Iguazu', total: 0 },
    ]
  }
  const map = new Map<string, number>()
  for (const row of data as CidadeRow[]) {
    const key = String(row.cidade ?? 'Sem cidade')
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return topN(Array.from(map.entries()).map(([label, total]) => ({ label, total })), 8)
}

async function fetchEmpresasSegmento(): Promise<DadoBarras[]> {
  const { data, error } = await supabase.from('empresas').select('categoria')
  if (error) throw error
  const map = new Map<string, number>()
  for (const row of (data ?? []) as CategoriaRow[]) {
    const key = String(row.categoria ?? 'Sem categoria')
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return topN(Array.from(map.entries()).map(([label, total]) => ({ label, total })), 8)
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

function getLabelServico(servico: string): string {
  const labels: Record<string, string> = {
    mobilidade: 'Mobilidade',
    rede_social: 'Rede Social',
    guia: 'Guia',
    compras: 'Compras',
  }
  return labels[servico] ?? servico
}

function getLabelCategoriaGuia(categoria: string): string {
  const labels: Record<string, string> = {
    gastronomia: 'Gastronomia',
    lojas: 'Lojas',
    hotelaria: 'Hotelaria',
    passeios: 'Passeios',
  }
  return labels[categoria] ?? categoria
}

