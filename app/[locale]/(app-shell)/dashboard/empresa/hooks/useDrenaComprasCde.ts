'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  agregarRankingTermos,
  inicioPeriodoIso,
  pizzaFromContagens,
  type FatiaCategoria,
  type PeriodoDrena,
  type TermoRanking,
} from '@/lib/drenaAnalytics'

export type ItemNomeTotal = {
  id: string
  nome: string
  total: number
}

function chunkTermos(ranking: TermoRanking[], tamanho = 20): TermoRanking[][] {
  const grupos: TermoRanking[][] = []
  for (let i = 0; i < ranking.length; i += tamanho) {
    grupos.push(ranking.slice(i, i + tamanho))
  }
  while (grupos.length < 5) grupos.push([])
  return grupos.slice(0, 5)
}

async function nomesPorIds(
  tabela: 'produto_categorias' | 'produto_subcategorias' | 'produto_marcas',
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!ids.length) return map
  const { data } = await supabase.from(tabela).select('id, nome').in('id', ids)
  for (const r of data ?? []) {
    if (r.id) map.set(String(r.id), String(r.nome ?? '—'))
  }
  return map
}

function rankingFromCountMap(
  counts: Map<string, number>,
  nomes: Map<string, string>,
): ItemNomeTotal[] {
  return [...counts.entries()]
    .map(([id, total]) => ({
      id,
      nome: nomes.get(id) ?? '—',
      total,
    }))
    .sort((a, b) => b.total - a.total)
}

export function useDrenaComprasCde() {
  const [periodo, setPeriodo] = useState<PeriodoDrena>('7d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const [rankingTuristas, setRankingTuristas] = useState<TermoRanking[]>([])
  const [rankingProfissionais, setRankingProfissionais] = useState<TermoRanking[]>([])

  const [recCategorias, setRecCategorias] = useState<ItemNomeTotal[]>([])
  const [recSubcategorias, setRecSubcategorias] = useState<ItemNomeTotal[]>([])
  const [recMarcas, setRecMarcas] = useState<ItemNomeTotal[]>([])

  const [filtroCategorias, setFiltroCategorias] = useState<ItemNomeTotal[]>([])
  const [filtroSubcategorias, setFiltroSubcategorias] = useState<ItemNomeTotal[]>([])
  const [motorCategorias, setMotorCategorias] = useState<ItemNomeTotal[]>([])
  const [motorSubcategorias, setMotorSubcategorias] = useState<ItemNomeTotal[]>([])

  const [pizzaBuscas, setPizzaBuscas] = useState<FatiaCategoria[]>([])
  const [listaDesempenhoCat, setListaDesempenhoCat] = useState<ItemNomeTotal[]>([])

  const fetchDados = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const desde = inicioPeriodoIso(periodo)

      const { data: buscas, error: bErr } = await supabase
        .from('buscas_produto')
        .select('termo_busca, tipo, perfil, categoria_id, subcategoria_id, marca_id, produto_id')
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(12000)
      if (bErr) throw bErr

      const rows = buscas ?? []

      const buscasTurista = rows.filter(
        (r) => r.tipo === 'busca' && String(r.perfil ?? '') === 'turista',
      )
      const buscasProf = rows.filter(
        (r) => r.tipo === 'busca' && String(r.perfil ?? '') === 'profissional',
      )
      setRankingTuristas(agregarRankingTermos(buscasTurista, 100))
      setRankingProfissionais(agregarRankingTermos(buscasProf, 100))

      // Recomendações de produto (mercado)
      const catRec = new Map<string, number>()
      const subRec = new Map<string, number>()
      const marcaRec = new Map<string, number>()
      const { data: recs, error: rErr } = await supabase
        .from('recomendacoes_produto')
        .select('categoria_id, subcategoria_id, marca_id')
        .gte('created_at', desde)
        .limit(8000)
      if (rErr) {
        console.warn('[useDrenaComprasCde] recomendacoes_produto:', rErr.message)
      } else {
        for (const r of recs ?? []) {
          if (r.categoria_id) {
            const id = String(r.categoria_id)
            catRec.set(id, (catRec.get(id) ?? 0) + 1)
          }
          if (r.subcategoria_id) {
            const id = String(r.subcategoria_id)
            subRec.set(id, (subRec.get(id) ?? 0) + 1)
          }
          if (r.marca_id) {
            const id = String(r.marca_id)
            marcaRec.set(id, (marcaRec.get(id) ?? 0) + 1)
          }
        }
      }

      // Filtro popup
      const catFiltro = new Map<string, number>()
      const subFiltro = new Map<string, number>()
      for (const r of rows) {
        if (r.tipo !== 'filtro') continue
        if (r.categoria_id && !r.subcategoria_id) {
          const id = String(r.categoria_id)
          catFiltro.set(id, (catFiltro.get(id) ?? 0) + 1)
        }
        if (r.subcategoria_id) {
          const id = String(r.subcategoria_id)
          subFiltro.set(id, (subFiltro.get(id) ?? 0) + 1)
        }
      }

      // Motor: clique em produto localizado (cat/sub do produto)
      const catMotor = new Map<string, number>()
      const subMotor = new Map<string, number>()
      for (const r of rows) {
        if (r.tipo !== 'clique') continue
        if (r.categoria_id) {
          const id = String(r.categoria_id)
          catMotor.set(id, (catMotor.get(id) ?? 0) + 1)
        }
        if (r.subcategoria_id) {
          const id = String(r.subcategoria_id)
          subMotor.set(id, (subMotor.get(id) ?? 0) + 1)
        }
      }

      // Desempenho geral por categoria: filtro + clique + impressão
      const catGeral = new Map<string, number>()
      for (const r of rows) {
        if (!r.categoria_id) continue
        if (r.tipo !== 'filtro' && r.tipo !== 'clique' && r.tipo !== 'impressao' && r.tipo !== 'busca')
          continue
        // busca sem categoria_id não entra; filtro/clique/impressão sim
        if (r.tipo === 'busca') continue
        const id = String(r.categoria_id)
        catGeral.set(id, (catGeral.get(id) ?? 0) + 1)
      }

      const allCatIds = [
        ...new Set([
          ...catRec.keys(),
          ...catFiltro.keys(),
          ...catMotor.keys(),
          ...catGeral.keys(),
        ]),
      ]
      const allSubIds = [
        ...new Set([...subRec.keys(), ...subFiltro.keys(), ...subMotor.keys()]),
      ]
      const allMarcaIds = [...marcaRec.keys()]

      const [nomesCat, nomesSub, nomesMarca] = await Promise.all([
        nomesPorIds('produto_categorias', allCatIds),
        nomesPorIds('produto_subcategorias', allSubIds),
        nomesPorIds('produto_marcas', allMarcaIds),
      ])

      setRecCategorias(rankingFromCountMap(catRec, nomesCat))
      setRecSubcategorias(rankingFromCountMap(subRec, nomesSub))
      setRecMarcas(rankingFromCountMap(marcaRec, nomesMarca))
      setFiltroCategorias(rankingFromCountMap(catFiltro, nomesCat))
      setFiltroSubcategorias(rankingFromCountMap(subFiltro, nomesSub))
      setMotorCategorias(rankingFromCountMap(catMotor, nomesCat))
      setMotorSubcategorias(rankingFromCountMap(subMotor, nomesSub))

      const listaGeral = rankingFromCountMap(catGeral, nomesCat)
      setListaDesempenhoCat(listaGeral)
      setPizzaBuscas(
        pizzaFromContagens(
          new Map(listaGeral.map((i) => [i.id, { nome: i.nome, total: i.total }])),
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Erro ao carregar Compras CDE Drena'))
      setRankingTuristas([])
      setRankingProfissionais([])
      setRecCategorias([])
      setRecSubcategorias([])
      setRecMarcas([])
      setFiltroCategorias([])
      setFiltroSubcategorias([])
      setMotorCategorias([])
      setMotorSubcategorias([])
      setPizzaBuscas([])
      setListaDesempenhoCat([])
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  const gruposTuristas = useMemo(() => chunkTermos(rankingTuristas), [rankingTuristas])
  const gruposProfissionais = useMemo(
    () => chunkTermos(rankingProfissionais),
    [rankingProfissionais],
  )

  return {
    periodo,
    setPeriodo,
    loading,
    error,
    gruposTuristas,
    gruposProfissionais,
    rankingTuristas,
    rankingProfissionais,
    recCategorias,
    recSubcategorias,
    recMarcas,
    filtroCategorias,
    filtroSubcategorias,
    motorCategorias,
    motorSubcategorias,
    pizzaBuscas,
    listaDesempenhoCat,
    refetch: fetchDados,
  }
}
