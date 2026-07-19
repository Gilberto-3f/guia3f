'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  inicioPeriodoIso,
  pizzaFromContagens,
  type FatiaCategoria,
  type PeriodoDrena,
  type ProdutoRankingItem,
  type SecaoCategoriaRanking,
} from '@/lib/drenaAnalytics'

type ProdutoRow = {
  id: string
  nome: string
  fotos: unknown
  foto_url: string | null
  categoria_id: string | null
  produto_categorias: { id?: string; nome?: string; ordem?: number } | null
  produto_subcategorias: { nome?: string } | null
  produto_marcas: { nome?: string } | null
}

function capaProduto(p: ProdutoRow): string | null {
  if (Array.isArray(p.fotos) && p.fotos.length) {
    const u = String(p.fotos[0] ?? '').trim()
    if (u) return u
  }
  return p.foto_url ? String(p.foto_url) : null
}

export function useDrenaCatalogo(empresaId: string | null) {
  const [periodo, setPeriodo] = useState<PeriodoDrena>('7d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [produtos, setProdutos] = useState<ProdutoRankingItem[]>([])
  const [pizzaCliques, setPizzaCliques] = useState<FatiaCategoria[]>([])
  const [pizzaRecomendacoes, setPizzaRecomendacoes] = useState<FatiaCategoria[]>([])
  const [totalFavoritos, setTotalFavoritos] = useState(0)
  const [totalRepostados, setTotalRepostados] = useState(0)

  const fetchDados = useCallback(async () => {
    if (!empresaId) {
      setProdutos([])
      setPizzaCliques([])
      setPizzaRecomendacoes([])
      setTotalFavoritos(0)
      setTotalRepostados(0)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const desde = inicioPeriodoIso(periodo)

      const { data: prodData, error: pErr } = await supabase
        .from('produtos')
        .select(
          `
          id, nome, fotos, foto_url, categoria_id,
          produto_categorias ( id, nome, ordem ),
          produto_subcategorias ( nome ),
          produto_marcas ( nome )
        `,
        )
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
      if (pErr) throw pErr

      const lista = (prodData ?? []) as ProdutoRow[]
      const ids = lista.map((p) => String(p.id)).filter(Boolean)
      const meta = new Map<string, ProdutoRankingItem>()

      for (const p of lista) {
        const id = String(p.id)
        const cat = p.produto_categorias
        meta.set(id, {
          id,
          nome: String(p.nome ?? ''),
          fotoUrl: capaProduto(p),
          categoriaId: p.categoria_id ? String(p.categoria_id) : null,
          categoriaNome: cat?.nome ? String(cat.nome) : 'Outros',
          subcategoriaNome: p.produto_subcategorias?.nome
            ? String(p.produto_subcategorias.nome)
            : null,
          marcaNome: p.produto_marcas?.nome ? String(p.produto_marcas.nome) : null,
          cliques: 0,
          impressoes: 0,
          recomendacoes: 0,
        })
      }

      if (ids.length) {
        const { data: buscas, error: bErr } = await supabase
          .from('buscas_produto')
          .select('produto_id, tipo')
          .in('produto_id', ids)
          .in('tipo', ['clique', 'impressao'])
          .gte('created_at', desde)
          .limit(12000)
        if (bErr) throw bErr

        for (const b of buscas ?? []) {
          const pid = b.produto_id ? String(b.produto_id) : ''
          const item = meta.get(pid)
          if (!item) continue
          if (b.tipo === 'clique') item.cliques += 1
          else if (b.tipo === 'impressao') item.impressoes += 1
        }

        const { data: recs, error: rErr } = await supabase
          .from('recomendacoes_produto')
          .select('produto_id, categoria_id')
          .eq('empresa_id', empresaId)
          .gte('created_at', desde)
          .limit(8000)

        if (rErr) {
          // Tabela pode não existir ainda no remoto legado
          console.warn('[useDrenaCatalogo] recomendacoes_produto:', rErr.message)
        } else {
          for (const r of recs ?? []) {
            const pid = r.produto_id ? String(r.produto_id) : ''
            const item = meta.get(pid)
            if (item) item.recomendacoes += 1
          }
        }
      }

      const ranking = [...meta.values()].sort(
        (a, b) => b.cliques - a.cliques || b.impressoes - a.impressoes || a.nome.localeCompare(b.nome),
      )
      setProdutos(ranking)

      const mapCliques = new Map<string, { nome: string; total: number }>()
      const mapRecs = new Map<string, { nome: string; total: number }>()
      for (const p of ranking) {
        const key = p.categoriaId ?? 'outros'
        const nome = p.categoriaNome || 'Outros'
        if (p.cliques > 0) {
          const cur = mapCliques.get(key)
          if (cur) cur.total += p.cliques
          else mapCliques.set(key, { nome, total: p.cliques })
        }
        if (p.recomendacoes > 0) {
          const cur = mapRecs.get(key)
          if (cur) cur.total += p.recomendacoes
          else mapRecs.set(key, { nome, total: p.recomendacoes })
        }
      }
      setPizzaCliques(pizzaFromContagens(mapCliques))
      setPizzaRecomendacoes(pizzaFromContagens(mapRecs))

      let fav = 0
      let rep = 0
      const { data: eng, error: engErr } = await supabase.rpc('drena_metricas_catalogo_engajamento', {
        p_empresa_id: empresaId,
        p_desde: desde,
      })
      if (engErr) {
        console.warn('[useDrenaCatalogo] drena_metricas_catalogo_engajamento:', engErr.message)
      } else if (eng && typeof eng === 'object' && !Array.isArray(eng)) {
        const o = eng as { favoritos?: unknown; repostados?: unknown }
        fav = Number(o.favoritos) || 0
        rep = Number(o.repostados) || 0
      }
      setTotalFavoritos(fav)
      setTotalRepostados(rep)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Erro ao carregar Catálogo Drena'))
      setProdutos([])
      setPizzaCliques([])
      setPizzaRecomendacoes([])
      setTotalFavoritos(0)
      setTotalRepostados(0)
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  const secoesPorCliques = useMemo((): SecaoCategoriaRanking[] => {
    const map = new Map<string, SecaoCategoriaRanking>()
    for (const p of produtos) {
      if (p.cliques <= 0 && p.impressoes <= 0) continue
      const key = p.categoriaId ?? 'outros'
      if (!map.has(key)) {
        map.set(key, {
          categoriaId: key,
          categoriaNome: p.categoriaNome || 'Outros',
          ordem: 0,
          produtos: [],
          totalCliques: 0,
          totalRecomendacoes: 0,
        })
      }
      const sec = map.get(key)!
      sec.produtos.push(p)
      sec.totalCliques += p.cliques
    }
    for (const sec of map.values()) {
      sec.produtos.sort((a, b) => b.cliques - a.cliques || b.impressoes - a.impressoes)
    }
    return [...map.values()].sort(
      (a, b) => b.totalCliques - a.totalCliques || a.categoriaNome.localeCompare(b.categoriaNome),
    )
  }, [produtos])

  const secoesPorRecomendacoes = useMemo((): SecaoCategoriaRanking[] => {
    const map = new Map<string, SecaoCategoriaRanking>()
    for (const p of produtos) {
      if (p.recomendacoes <= 0) continue
      const key = p.categoriaId ?? 'outros'
      if (!map.has(key)) {
        map.set(key, {
          categoriaId: key,
          categoriaNome: p.categoriaNome || 'Outros',
          ordem: 0,
          produtos: [],
          totalCliques: 0,
          totalRecomendacoes: 0,
        })
      }
      const sec = map.get(key)!
      sec.produtos.push(p)
      sec.totalRecomendacoes += p.recomendacoes
    }
    for (const sec of map.values()) {
      sec.produtos.sort((a, b) => b.recomendacoes - a.recomendacoes)
    }
    return [...map.values()].sort(
      (a, b) =>
        b.totalRecomendacoes - a.totalRecomendacoes || a.categoriaNome.localeCompare(b.categoriaNome),
    )
  }, [produtos])

  const totalCliques = useMemo(() => produtos.reduce((a, p) => a + p.cliques, 0), [produtos])
  const totalImpressoes = useMemo(() => produtos.reduce((a, p) => a + p.impressoes, 0), [produtos])
  const totalRecomendacoes = useMemo(
    () => produtos.reduce((a, p) => a + p.recomendacoes, 0),
    [produtos],
  )

  return {
    periodo,
    setPeriodo,
    loading,
    error,
    produtos,
    secoesPorCliques,
    secoesPorRecomendacoes,
    pizzaCliques,
    pizzaRecomendacoes,
    totalCliques,
    totalImpressoes,
    totalRecomendacoes,
    totalFavoritos,
    totalRepostados,
    refetch: fetchDados,
  }
}
