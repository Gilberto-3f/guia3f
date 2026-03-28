'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  MarcaRanking,
  Produto,
  ProdutoRanking,
  SegmentoAlta,
  Tendencia,
} from '../types/dashboard.types'

type DesempenhoItem = { nome: string; buscas: number; posicao: number }

function asRecord(v: unknown) {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function asString(v: unknown, fallback = '') {
  return v != null ? String(v) : fallback
}

function asNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function getSegmentoLabel(segmento: string): string {
  const labels: Record<string, string> = {
    smartphones: 'Smartphones',
    perfumaria: 'Perfumaria',
    eletronicos: 'Eletrônicos',
    vestuario: 'Vestuário',
    bebidas: 'Bebidas',
    brinquedos: 'Brinquedos',
  }
  return labels[segmento] || segmento
}

function randomVariacao() {
  return Math.floor(Math.random() * 60) - 30
}

export function useDrenaStok(empresaId: string | null, isCDE: boolean) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [totalProdutos, setTotalProdutos] = useState(0)
  const [totalBuscasProdutos, setTotalBuscasProdutos] = useState(0)
  const [desempenho, setDesempenho] = useState<DesempenhoItem[]>([])
  const [rankingProdutos, setRankingProdutos] = useState<ProdutoRanking[]>([])
  const [rankingMarcas, setRankingMarcas] = useState<MarcaRanking[]>([])
  const [segmentosAlta, setSegmentosAlta] = useState<SegmentoAlta[]>([])
  const [tendencias, setTendencias] = useState<Tendencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDados = useCallback(async () => {
    if (!empresaId || !isCDE) {
      setLoading(false)
      setError(null)
      setProdutos([])
      setTotalProdutos(0)
      setTotalBuscasProdutos(0)
      setDesempenho([])
      setRankingProdutos([])
      setRankingMarcas([])
      setSegmentosAlta([])
      setTendencias([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1) Produtos da empresa
      const { data: produtosData, error: pErr } = await supabase
        .from('produtos')
        .select('id, nome, descricao, categoria_drena, marca, preco_brl, foto_url, created_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
      if (pErr) throw pErr

      const meusProdutos: Produto[] = (produtosData ?? []).map((r) => {
        const row = asRecord(r) ?? {}
        return {
          id: asString(row.id),
          nome: asString(row.nome),
          descricao: row.descricao != null ? String(row.descricao) : null,
          categoria_drena: asString(row.categoria_drena),
          marca: row.marca != null ? String(row.marca) : null,
          preco_brl: row.preco_brl != null ? asNumber(row.preco_brl, 0) : null,
          foto_url: row.foto_url != null ? String(row.foto_url) : null,
        }
      })

      setProdutos(meusProdutos)
      setTotalProdutos(meusProdutos.length)

      const produtoIds = meusProdutos.map((p) => p.id).filter(Boolean)

      // 2) Total buscas nos meus produtos
      let buscasMeuTotal = 0
      const buscasPorProduto: Record<string, number> = {}
      if (produtoIds.length > 0) {
        const { data: buscasData, error: bErr } = await supabase
          .from('buscas_produto')
          .select('produto_id')
          .in('produto_id', produtoIds)
        if (bErr) throw bErr
        for (const b of (buscasData ?? []) as unknown[]) {
          const row = asRecord(b) ?? {}
          const pid = asString(row.produto_id)
          if (!pid) continue
          buscasMeuTotal += 1
          buscasPorProduto[pid] = (buscasPorProduto[pid] ?? 0) + 1
        }
      }
      setTotalBuscasProdutos(buscasMeuTotal)

      // 3) Ranking geral de produtos (por volume de buscas)
      const { data: rankingData, error: rErr } = await supabase
        .from('buscas_produto')
        .select(
          `
          produto_id,
          produtos:produto_id (id, nome, categoria_drena, marca)
        `
        )
        .not('produto_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5000)
      if (rErr) throw rErr

      const rankingAgg: Record<string, { nome: string; categoria_drena: string; marca: string | null; total: number }> = {}
      for (const item of (rankingData ?? []) as unknown[]) {
        const row = asRecord(item) ?? {}
        const pid = asString(row.produto_id)
        if (!pid) continue
        const prod = asRecord(row.produtos)
        const nome = prod?.nome != null ? String(prod.nome) : 'Produto'
        const categoria_drena = prod?.categoria_drena != null ? String(prod.categoria_drena) : 'outros'
        const marca = prod?.marca != null ? String(prod.marca) : null
        if (!rankingAgg[pid]) rankingAgg[pid] = { nome, categoria_drena, marca, total: 0 }
        rankingAgg[pid].total += 1
      }

      const rankingArray: ProdutoRanking[] = Object.entries(rankingAgg)
        .map(([id, d]) => ({
          id,
          nome: d.nome,
          categoria_drena: d.categoria_drena,
          marca: d.marca,
          total_buscas: d.total,
          variacao: randomVariacao(),
        }))
        .sort((a, b) => b.total_buscas - a.total_buscas)
        .slice(0, 30)

      setRankingProdutos(rankingArray)

      // 4) Desempenho (top 3 dos meus produtos)
      const desempenhoArray: DesempenhoItem[] = produtoIds
        .map((id) => {
          const pos = rankingArray.findIndex((r) => r.id === id)
          const p = meusProdutos.find((x) => x.id === id)
          return { nome: p?.nome ?? '', buscas: buscasPorProduto[id] ?? 0, posicao: pos !== -1 ? pos + 1 : 0 }
        })
        .filter((x) => x.buscas > 0)
        .sort((a, b) => b.buscas - a.buscas)
      setDesempenho(desempenhoArray)

      // 5) Ranking de marcas (a partir do ranking de produtos)
      const marcasAgg: Record<string, { total: number; principal_produto: string }> = {}
      for (const prod of rankingArray) {
        if (!prod.marca) continue
        if (!marcasAgg[prod.marca]) marcasAgg[prod.marca] = { total: 0, principal_produto: prod.nome }
        marcasAgg[prod.marca].total += prod.total_buscas
      }

      const marcasArray: MarcaRanking[] = Object.entries(marcasAgg)
        .map(([marca, d]) => ({
          marca,
          principal_produto: d.principal_produto,
          total_buscas: d.total,
          variacao: randomVariacao(),
        }))
        .sort((a, b) => b.total_buscas - a.total_buscas)
        .slice(0, 20)

      setRankingMarcas(marcasArray)

      // 6) Segmentos em alta (top 5)
      const segAgg: Record<string, number> = {}
      for (const prod of rankingArray) {
        const k = prod.categoria_drena || 'outros'
        segAgg[k] = (segAgg[k] ?? 0) + prod.total_buscas
      }
      const totalBuscasGeral = Object.values(segAgg).reduce((a, b) => a + b, 0)
      const segArray: SegmentoAlta[] = Object.entries(segAgg)
        .map(([segmento, total]) => ({
          segmento: getSegmentoLabel(segmento),
          percentual: totalBuscasGeral ? (total / totalBuscasGeral) * 100 : 0,
          total_buscas: total,
        }))
        .sort((a, b) => b.percentual - a.percentual)
        .slice(0, 5)
      setSegmentosAlta(segArray)

      // 7) Tendências em tempo real (últimas 24h)
      const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: buscas24hData, error: tErr } = await supabase
        .from('buscas_produto')
        .select(
          `
          produto_id,
          produtos:produto_id (id, nome)
        `
        )
        .gte('created_at', umDiaAtras)
        .not('produto_id', 'is', null)
        .limit(5000)
      if (tErr) throw tErr

      const b24Agg: Record<string, { nome: string; total: number }> = {}
      for (const row of (buscas24hData ?? []) as unknown[]) {
        const r = asRecord(row) ?? {}
        const pid = asString(r.produto_id)
        if (!pid) continue
        const prod = asRecord(r.produtos)
        const nome = prod?.nome != null ? String(prod.nome) : 'Produto'
        if (!b24Agg[pid]) b24Agg[pid] = { nome, total: 0 }
        b24Agg[pid].total += 1
      }

      const tendenciasArray: Tendencia[] = Object.values(b24Agg)
        .map((d) => ({
          nome: d.nome,
          crescimento: Math.floor(Math.random() * 200) + 50,
          buscas: d.total,
        }))
        .sort((a, b) => b.crescimento - a.crescimento)
        .slice(0, 10)
      setTendencias(tendenciasArray)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar Drena-Stok'))
    } finally {
      setLoading(false)
    }
  }, [empresaId, isCDE])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  return useMemo(
    () => ({
      produtos,
      totalProdutos,
      totalBuscasProdutos,
      desempenho,
      rankingProdutos,
      rankingMarcas,
      segmentosAlta,
      tendencias,
      loading,
      error,
      refetch: fetchDados,
    }),
    [
      produtos,
      totalProdutos,
      totalBuscasProdutos,
      desempenho,
      rankingProdutos,
      rankingMarcas,
      segmentosAlta,
      tendencias,
      loading,
      error,
      fetchDados,
    ]
  )
}

