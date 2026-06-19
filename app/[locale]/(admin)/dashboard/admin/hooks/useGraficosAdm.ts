'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  agregarAtendimentosPorCategoria,
  normalizarCategoriaMobilidade,
  normalizarCidadeTriplice,
  type AtendimentoMobilidadeRow,
  type CategoriaMobilidade,
  type CidadeTriplice,
  CATEGORIAS_MOBILIDADE_ORDEM,
  CIDADES_TRIPLICE_ORDEM,
  CORES_CIDADE_TRIPLICE,
} from '@/lib/mobilidadeRegional'
import {
  normalizarCategoriaEmpresaGuia,
  ROTULO_SEGUIMENTO_GUIA,
  type CategoriaEmpresaDb,
  CATEGORIAS_EMPRESA_DB,
} from '@/lib/segmentosEmpresaGuia'

export type PeriodoAdm = '7d' | '30d' | '90d' | '12m'

export type DadosAtendimentosCategoria = {
  categoria: string
  total: number
  percentual: number
}

export type DadosAtendimentosCidade = {
  cidade: string
  total: number
  percentual: number
}

export type Rota = {
  origem: string
  destino: string
  total: number
}

export type DadosVendasCategoria = {
  categoria: string
  total: number
  percentual: number
}

export type VendasConcluidas = {
  total: number
  mobilidade: number
  guia: number
}

function getDataLimite(periodo: PeriodoAdm): string {
  const now = new Date()
  if (periodo === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (periodo === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  if (periodo === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string') as string[]
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      if (Array.isArray(p)) return p.filter((x) => typeof x === 'string') as string[]
    } catch {
      // ignore
    }
  }
  return []
}

function mapAgregadoCategoria(
  items: { label: CategoriaMobilidade; valor: number; percentual: number }[],
): DadosAtendimentosCategoria[] {
  return items.map(({ label, valor, percentual }) => ({
    categoria: label,
    total: valor,
    percentual,
  }))
}

function mapAgregadoVendas(
  map: Map<string, number>,
  rotulos?: Record<string, string>,
): DadosVendasCategoria[] {
  const total = Array.from(map.values()).reduce((a, v) => a + v, 0) || 1
  return Array.from(map.entries())
    .map(([categoria, v]) => ({
      categoria: rotulos?.[categoria] ?? categoria,
      total: v,
      percentual: (v / total) * 100,
    }))
    .sort((a, b) => b.total - a.total)
}

export function useGraficosAdm(periodo: PeriodoAdm) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [atendimentosCategoria, setAtendimentosCategoria] = useState<DadosAtendimentosCategoria[]>([])
  const [atendimentosCidade, setAtendimentosCidade] = useState<DadosAtendimentosCidade[]>([])
  const [rotas, setRotas] = useState<Rota[]>([])
  const [vendasProfissionalCategoria, setVendasProfissionalCategoria] = useState<DadosVendasCategoria[]>([])
  const [vendasEmpresaSegmento, setVendasEmpresaSegmento] = useState<DadosVendasCategoria[]>([])
  const [vendasConcluidas, setVendasConcluidas] = useState<VendasConcluidas>({ total: 0, mobilidade: 0, guia: 0 })
  const [assinantes, setAssinantes] = useState(0)

  const fetchAtendimentos = useCallback(async () => {
    const since = getDataLimite(periodo)
    const desde = new Date(since)

    const selectCompleto = `
      created_at,
      status,
      profissionais:profissional_id (categorias, cidade_atuacao)
    `

    const selectBasico = `
      created_at,
      status,
      profissionais:profissional_id (categorias, cidade_atuacao)
    `

    let { data: solData, error: solErr } = await supabase
      .from('solicitacao_mobilidade')
      .select(selectCompleto)
      .gte('created_at', since)
      .eq('status', 'concluida')

    if (solErr && String(solErr.message ?? '').toLowerCase().includes('does not exist')) {
      const retry = await supabase
        .from('solicitacao_mobilidade')
        .select(selectBasico)
        .gte('created_at', since)
        .eq('status', 'concluida')
      solData = retry.data
      solErr = retry.error
    }

    if (!solErr && solData && solData.length > 0) {
      const rows: AtendimentoMobilidadeRow[] = (solData as Array<Record<string, unknown>>).map((r) => {
        const p = r.profissionais
        const prof = p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null
        const categoria =
          (prof?.categoria != null ? String(prof.categoria) : '') || asStringArray(prof?.categorias)[0] || 'outros'
        const cidades = asStringArray(prof?.cidade_atuacao)
        return {
          categoria,
          cidades,
          createdAt: String(r.created_at ?? ''),
          status: String(r.status ?? ''),
        }
      })

      const porCat = agregarAtendimentosPorCategoria(rows, { desde })
      setAtendimentosCategoria(mapAgregadoCategoria(porCat))

      const porCidade: Record<CidadeTriplice, number> = {
        'Foz do Iguaçu': 0,
        'Ciudad del Este': 0,
        'Puerto Iguazu': 0,
      }
      for (const row of rows) {
        if (desde && new Date(row.createdAt) < desde) continue
        for (const raw of row.cidades) {
          const cidade = normalizarCidadeTriplice(raw)
          if (cidade) {
            porCidade[cidade] += 1
            break
          }
        }
      }
      const totalCid = Object.values(porCidade).reduce((a, v) => a + v, 0) || 1
      setAtendimentosCidade(
        CIDADES_TRIPLICE_ORDEM.map((cidade) => ({
          cidade,
          total: porCidade[cidade],
          percentual: (porCidade[cidade] / totalCid) * 100,
        })),
      )
      return
    }

    const { data, error: e } = await supabase
      .from('logs_atendimentos')
      .select('profissional_id, empresa_id, tipo_servico')
      .gte('data_atendimento', since)

    if (e || !data || data.length === 0) {
      setAtendimentosCategoria(
        CATEGORIAS_MOBILIDADE_ORDEM.map((c) => ({ categoria: c, total: 0, percentual: 0 })),
      )
      setAtendimentosCidade(
        CIDADES_TRIPLICE_ORDEM.map((c) => ({ cidade: c, total: 0, percentual: 0 })),
      )
      return
    }

    const profIds = Array.from(
      new Set(
        (data as Array<{ profissional_id: string | null }>)
          .map((r) => r.profissional_id)
          .filter((v): v is string => typeof v === 'string' && v.length > 0),
      ),
    )
    const empIds = Array.from(
      new Set(
        (data as Array<{ empresa_id: string | null }>)
          .map((r) => r.empresa_id)
          .filter((v): v is string => typeof v === 'string' && v.length > 0),
      ),
    )

    const [{ data: profs }, { data: emps }] = await Promise.all([
      profIds.length
        ? supabase.from('profissionais').select('id, categorias, cidade_atuacao').in('id', profIds)
        : Promise.resolve({ data: [] }),
      empIds.length
        ? supabase.from('empresas').select('id, cidade').in('id', empIds)
        : Promise.resolve({ data: [] }),
    ])

    const profMap = new Map<string, { categorias: unknown; cidade_atuacao: unknown }>()
    for (const row of profs ?? []) {
      const r = row as { id: string; categorias: unknown; cidade_atuacao: unknown }
      profMap.set(String(r.id), { categorias: r.categorias, cidade_atuacao: r.cidade_atuacao })
    }
    const empCidade = new Map<string, string>()
    for (const row of emps ?? []) {
      empCidade.set(String((row as { id: string }).id), String((row as { cidade?: string }).cidade ?? ''))
    }

    const catCount: Record<CategoriaMobilidade, number> = {
      'Motoristas de App': 0,
      'Motoristas de Van': 0,
      Taxistas: 0,
      'Guias de Turismo': 0,
      Anfitriões: 0,
    }
    const porCidade: Record<CidadeTriplice, number> = {
      'Foz do Iguaçu': 0,
      'Ciudad del Este': 0,
      'Puerto Iguazu': 0,
    }

    for (const row of data as Array<{
      profissional_id: string | null
      empresa_id: string | null
      tipo_servico: string | null
    }>) {
      const prof = row.profissional_id ? profMap.get(row.profissional_id) : null
      let cat: CategoriaMobilidade | null = null
      if (prof) {
        for (const raw of asStringArray(prof.categorias)) {
          cat = normalizarCategoriaMobilidade(raw)
          if (cat) break
        }
      }
      if (!cat) cat = normalizarCategoriaMobilidade(row.tipo_servico)
      if (cat) catCount[cat] += 1

      let cidade: CidadeTriplice | null = null
      if (prof) {
        for (const raw of asStringArray(prof.cidade_atuacao)) {
          cidade = normalizarCidadeTriplice(raw)
          if (cidade) break
        }
      }
      if (!cidade && row.empresa_id) {
        cidade = normalizarCidadeTriplice(empCidade.get(row.empresa_id))
      }
      if (cidade) porCidade[cidade] += 1
    }

    const totalCat = Object.values(catCount).reduce((a, v) => a + v, 0) || 1
    setAtendimentosCategoria(
      CATEGORIAS_MOBILIDADE_ORDEM.map((c) => ({
        categoria: c,
        total: catCount[c],
        percentual: (catCount[c] / totalCat) * 100,
      })),
    )

    const totalCid = Object.values(porCidade).reduce((a, v) => a + v, 0) || 1
    setAtendimentosCidade(
      CIDADES_TRIPLICE_ORDEM.map((c) => ({
        cidade: c,
        total: porCidade[c],
        percentual: (porCidade[c] / totalCid) * 100,
      })),
    )
  }, [periodo])

  const fetchRotas = useCallback(async () => {
    const since = getDataLimite(periodo)
    const { data, error: e } = await supabase.from('logs_rotas').select('origem, destino').gte('data_corrida', since)
    if (e || !data || data.length === 0) {
      setRotas([])
      return
    }
    const map = new Map<string, { origem: string; destino: string; total: number }>()
    for (const row of data as Array<{ origem: string; destino: string }>) {
      const key = `${row.origem}__${row.destino}`
      const entry = map.get(key) ?? { origem: row.origem, destino: row.destino, total: 0 }
      entry.total += 1
      map.set(key, entry)
    }
    setRotas(
      Array.from(map.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 15),
    )
  }, [periodo])

  const fetchVendas = useCallback(async () => {
    const since = getDataLimite(periodo)
    const { data, error: e } = await supabase
      .from('comissao')
      .select('empresa_id, profissional_id')
      .gte('created_at', since)

    if (e || !data || data.length === 0) {
      setVendasConcluidas({ total: 0, mobilidade: 0, guia: 0 })
      setVendasProfissionalCategoria([])
      setVendasEmpresaSegmento([])
      return
    }

    const rows = data as Array<{ empresa_id: string; profissional_id: string | null }>
    const mobilidade = rows.filter((r) => r.profissional_id != null).length
    const guia = rows.filter((r) => r.profissional_id == null).length
    setVendasConcluidas({ total: rows.length, mobilidade, guia })

    const profIds = Array.from(
      new Set(rows.map((r) => r.profissional_id).filter((v): v is string => typeof v === 'string' && v.length > 0)),
    )
    const empIds = Array.from(new Set(rows.map((r) => r.empresa_id).filter(Boolean)))

    const [{ data: profs }, { data: emps }] = await Promise.all([
      profIds.length
        ? supabase.from('profissionais').select('id, categorias').in('id', profIds)
        : Promise.resolve({ data: [] }),
      empIds.length
        ? supabase.from('empresas').select('id, categoria').in('id', empIds)
        : Promise.resolve({ data: [] }),
    ])

    const profCat = new Map<string, CategoriaMobilidade>()
    for (const row of profs ?? []) {
      const r = row as { id: string; categorias: unknown }
      for (const raw of asStringArray(r.categorias)) {
        const cat = normalizarCategoriaMobilidade(raw)
        if (cat) {
          profCat.set(String(r.id), cat)
          break
        }
      }
    }

    const empSeg = new Map<string, CategoriaEmpresaDb>()
    for (const row of emps ?? []) {
      const r = row as { id: string; categoria?: string | null }
      const cat = normalizarCategoriaEmpresaGuia(r.categoria)
      if (cat) empSeg.set(String(r.id), cat)
    }

    const catProfMap = new Map<string, number>()
    const segEmpMap = new Map<string, number>()

    for (const row of rows) {
      if (row.profissional_id) {
        const cat = profCat.get(row.profissional_id) ?? 'Outros'
        catProfMap.set(cat, (catProfMap.get(cat) ?? 0) + 1)
      }
      const seg = empSeg.get(row.empresa_id)
      if (seg) {
        segEmpMap.set(seg, (segEmpMap.get(seg) ?? 0) + 1)
      }
    }

    setVendasProfissionalCategoria(mapAgregadoVendas(catProfMap))
    setVendasEmpresaSegmento(
      mapAgregadoVendas(
        segEmpMap,
        Object.fromEntries(CATEGORIAS_EMPRESA_DB.map((c) => [c, ROTULO_SEGUIMENTO_GUIA[c]])),
      ),
    )
  }, [periodo])

  const fetchAssinantes = useCallback(async () => {
    const { count, error: e } = await supabase
      .from('empresas')
      .select('*', { count: 'exact', head: true })
      .neq('plano', 'gratuito')
      .not('plano', 'is', null)

    if (!e && count != null) {
      setAssinantes(count)
      return
    }

    const { count: fallback } = await supabase
      .from('empresas')
      .select('*', { count: 'exact', head: true })
      .in('plano', ['basico', 'premium', 'profissional', 'empresarial'])

    setAssinantes(fallback ?? 0)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([fetchAtendimentos(), fetchRotas(), fetchVendas(), fetchAssinantes()])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar gráficos'))
    } finally {
      setLoading(false)
    }
  }, [fetchAtendimentos, fetchRotas, fetchVendas, fetchAssinantes])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return {
    atendimentosCategoria,
    atendimentosCidade,
    rotas,
    vendasProfissionalCategoria,
    vendasEmpresaSegmento,
    vendasConcluidas,
    assinantes,
    loading,
    error,
    refetch: fetchData,
  }
}
