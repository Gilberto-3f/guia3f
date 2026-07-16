'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { normalizarTextoTaxonomia } from '@/lib/comprasCdeCatalogo'
import {
  agregarPizzaCategorias,
  agregarRankingTermos,
  inicioPeriodoIso,
  labelMes,
  serieHistoricoTermo,
  type FatiaCategoria,
  type PeriodoDrena,
  type PontoHistorico,
  type SnapshotMensalRow,
  type TermoRanking,
} from '@/lib/drenaAnalytics'

type DesempenhoItem = { nome: string; buscas: number; posicao: number }

export function useDrenaStok(empresaId: string | null, isCDE: boolean) {
  const [periodo, setPeriodo] = useState<PeriodoDrena>('7d')
  const [aba, setAba] = useState<'graficos' | 'historico'>('graficos')

  const [totalProdutos, setTotalProdutos] = useState(0)
  const [totalBuscasProdutos, setTotalBuscasProdutos] = useState(0)
  const [desempenho, setDesempenho] = useState<DesempenhoItem[]>([])
  const [rankingTermos, setRankingTermos] = useState<TermoRanking[]>([])
  const [pizzaCategorias, setPizzaCategorias] = useState<FatiaCategoria[]>([])

  const agora = new Date()
  const [histAno, setHistAno] = useState(agora.getFullYear())
  const [histMes, setHistMes] = useState(agora.getMonth() + 1)
  const [histTermo, setHistTermo] = useState('')
  const [snapshotMes, setSnapshotMes] = useState<SnapshotMensalRow[]>([])
  const [serieLinha, setSerieLinha] = useState<PontoHistorico[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchGraficos = useCallback(async () => {
    if (!empresaId || !isCDE) return

    const desde = inicioPeriodoIso(periodo)

    const { data: produtosData, error: pErr } = await supabase
      .from('produtos')
      .select('id, nome')
      .eq('empresa_id', empresaId)
    if (pErr) throw pErr

    const meus = (produtosData ?? []) as { id: string; nome: string }[]
    setTotalProdutos(meus.length)
    const produtoIds = meus.map((p) => p.id).filter(Boolean)

    let buscasMeu = 0
    const porProduto: Record<string, number> = {}
    if (produtoIds.length) {
      const { data: minhasBuscas, error: bErr } = await supabase
        .from('buscas_produto')
        .select('produto_id')
        .in('produto_id', produtoIds)
        .gte('created_at', desde)
        .limit(8000)
      if (bErr) throw bErr
      for (const b of minhasBuscas ?? []) {
        const pid = b.produto_id ? String(b.produto_id) : ''
        if (!pid) continue
        buscasMeu += 1
        porProduto[pid] = (porProduto[pid] ?? 0) + 1
      }
    }
    setTotalBuscasProdutos(buscasMeu)
    setDesempenho(
      produtoIds
        .map((id) => {
          const p = meus.find((x) => x.id === id)
          return { nome: p?.nome ?? '', buscas: porProduto[id] ?? 0, posicao: 0 }
        })
        .filter((x) => x.buscas > 0)
        .sort((a, b) => b.buscas - a.buscas)
        .slice(0, 5),
    )

    const { data: buscasPeriodo, error: rErr } = await supabase
      .from('buscas_produto')
      .select('termo_busca, categoria_id')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(8000)
    if (rErr) throw rErr

    const rows = (buscasPeriodo ?? []) as { termo_busca?: string | null; categoria_id?: string | null }[]
    setRankingTermos(agregarRankingTermos(rows, 50))

    const catIds = [...new Set(rows.map((r) => r.categoria_id).filter(Boolean).map(String))]
    const nomePorId = new Map<string, string>()
    if (catIds.length) {
      const { data: cats } = await supabase
        .from('produto_categorias')
        .select('id, nome')
        .in('id', catIds)
      for (const c of cats ?? []) {
        if (c.id) nomePorId.set(String(c.id), String(c.nome ?? 'Categoria'))
      }
    }

    setPizzaCategorias(
      agregarPizzaCategorias(
        rows.map((r) => {
          const id = r.categoria_id ? String(r.categoria_id) : ''
          return {
            categoria_id: id || null,
            categorias: id ? { id, nome: nomePorId.get(id) ?? 'Categoria' } : null,
          }
        }),
      ),
    )
  }, [empresaId, isCDE, periodo])

  const fetchHistorico = useCallback(async () => {
    if (!empresaId || !isCDE) return

    // Snapshot do mês selecionado
    const { data: snap, error: sErr } = await supabase
      .from('drena_intencao_mensal')
      .select('termo, termo_normalizado, tipo, total_buscas')
      .eq('ano', histAno)
      .eq('mes', histMes)
      .order('total_buscas', { ascending: false })
      .limit(50)

    if (sErr) {
      // Fallback: agrega live do mês se tabela/migration ainda não existir
      const inicio = new Date(Date.UTC(histAno, histMes - 1, 1)).toISOString()
      const fim = new Date(Date.UTC(histAno, histMes, 1)).toISOString()
      const { data: live, error: lErr } = await supabase
        .from('buscas_produto')
        .select('termo_busca')
        .gte('created_at', inicio)
        .lt('created_at', fim)
        .limit(8000)
      if (lErr) throw lErr
      const ranking = agregarRankingTermos(live ?? [], 50)
      setSnapshotMes(
        ranking.map((r) => ({
          termo: r.termo,
          termo_normalizado: r.termo_normalizado,
          tipo: 'busca',
          total_buscas: r.total,
        })),
      )
    } else if (!snap?.length) {
      const inicio = new Date(Date.UTC(histAno, histMes - 1, 1)).toISOString()
      const fim = new Date(Date.UTC(histAno, histMes, 1)).toISOString()
      const { data: live } = await supabase
        .from('buscas_produto')
        .select('termo_busca')
        .gte('created_at', inicio)
        .lt('created_at', fim)
        .limit(8000)
      const ranking = agregarRankingTermos(live ?? [], 50)
      setSnapshotMes(
        ranking.map((r) => ({
          termo: r.termo,
          termo_normalizado: r.termo_normalizado,
          tipo: 'busca',
          total_buscas: r.total,
        })),
      )
    } else {
      setSnapshotMes(
        (snap as SnapshotMensalRow[]).map((r) => ({
          termo: String(r.termo),
          termo_normalizado: String(r.termo_normalizado),
          tipo: String(r.tipo ?? 'busca'),
          total_buscas: Number(r.total_buscas) || 0,
        })),
      )
    }

    const termoQ = histTermo.trim()
    if (termoQ.length >= 2) {
      const norm = normalizarTextoTaxonomia(termoQ)
      const { data: serie } = await supabase
        .from('drena_intencao_mensal')
        .select('ano, mes, total_buscas')
        .eq('termo_normalizado', norm)
        .order('ano', { ascending: true })
        .order('mes', { ascending: true })
        .limit(36)

      if (serie?.length) {
        setSerieLinha(
          serieHistoricoTermo(
            (serie as { ano: number; mes: number; total_buscas: number }[]).map((s) => ({
              ano: Number(s.ano),
              mes: Number(s.mes),
              total_buscas: Number(s.total_buscas) || 0,
            })),
            12,
          ),
        )
      } else {
        // Fallback live últimos 12 meses (agrega no client)
        const pontos: { ano: number; mes: number; total_buscas: number }[] = []
        const agoraUtc = new Date()
        for (let i = 11; i >= 0; i--) {
          const d = new Date(Date.UTC(agoraUtc.getUTCFullYear(), agoraUtc.getUTCMonth() - i, 1))
          const ano = d.getUTCFullYear()
          const mes = d.getUTCMonth() + 1
          const inicio = new Date(Date.UTC(ano, mes - 1, 1)).toISOString()
          const fim = new Date(Date.UTC(ano, mes, 1)).toISOString()
          const { data: live } = await supabase
            .from('buscas_produto')
            .select('termo_busca')
            .gte('created_at', inicio)
            .lt('created_at', fim)
            .ilike('termo_busca', `%${termoQ}%`)
            .limit(3000)
          const total = (live ?? []).filter(
            (r) => normalizarTextoTaxonomia(String(r.termo_busca ?? '')) === norm,
          ).length
          pontos.push({ ano, mes, total_buscas: total })
        }
        setSerieLinha(serieHistoricoTermo(pontos, 12))
      }
    } else {
      setSerieLinha([])
    }
  }, [empresaId, isCDE, histAno, histMes, histTermo])

  const fetchDados = useCallback(async () => {
    if (!empresaId || !isCDE) {
      setLoading(false)
      setError(null)
      setTotalProdutos(0)
      setTotalBuscasProdutos(0)
      setDesempenho([])
      setRankingTermos([])
      setPizzaCategorias([])
      setSnapshotMes([])
      setSerieLinha([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (aba === 'graficos') await fetchGraficos()
      else await fetchHistorico()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar Drena-Stok'))
    } finally {
      setLoading(false)
    }
  }, [empresaId, isCDE, aba, fetchGraficos, fetchHistorico])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  return useMemo(
    () => ({
      aba,
      setAba,
      periodo,
      setPeriodo,
      totalProdutos,
      totalBuscasProdutos,
      desempenho,
      rankingTermos,
      pizzaCategorias,
      histAno,
      setHistAno,
      histMes,
      setHistMes,
      histTermo,
      setHistTermo,
      snapshotMes,
      serieLinha,
      labelMes,
      loading,
      error,
      refetch: fetchDados,
    }),
    [
      aba,
      periodo,
      totalProdutos,
      totalBuscasProdutos,
      desempenho,
      rankingTermos,
      pizzaCategorias,
      histAno,
      histMes,
      histTermo,
      snapshotMes,
      serieLinha,
      loading,
      error,
      fetchDados,
    ],
  )
}
