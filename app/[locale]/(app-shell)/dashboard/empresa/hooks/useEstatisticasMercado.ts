'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buscarAnaliseMercado, type AnaliseMercadoDados } from '@/lib/estatisticasMercadoAnalise'
import { preencherContagensSegmento, preencherComissaoSegmento } from '@/lib/segmentosMercado'
import type {
  DadosAtendimentosCategoria,
  DadosCrescimentoUsuarios,
  DadosComissaoRamo,
  DadosDistribuicaoProfissionais,
  DadosHorariosPico,
  DadosHistoricoAtendimentos,
  DadosOcupacaoHoteleira,
  DadosSegmentosGuia,
  DadosSegmentosRecomendados,
  Periodo,
} from '../types/dashboard.types'

function getDataLimite(periodo: Periodo): string | null {
  const now = new Date()
  if (periodo === 'hoje') {
    const inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return inicio.toISOString()
  }
  const base = new Date()
  const d =
    periodo === '7d'
      ? new Date(base.setDate(base.getDate() - 7))
      : periodo === '30d'
        ? new Date(base.setDate(base.getDate() - 30))
        : periodo === '90d'
          ? new Date(base.setDate(base.getDate() - 90))
          : null
  return d ? d.toISOString() : null
}

function safeIso(v: unknown) {
  const s = v != null ? String(v) : ''
  const d = s ? new Date(s) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

function monthKeyPtBR(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthLabelPtBR(ym: string) {
  const [y, m] = ym.split('-')
  const dt = new Date(Number(y), Number(m) - 1, 1)
  return dt.toLocaleString('pt-BR', { month: 'short' })
}

function asStringArray(v: unknown) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string') as string[]
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      if (Array.isArray(p)) return p.filter((x) => typeof x === 'string') as string[]
    } catch {
      // ignore
    }
  }
  return [] as string[]
}

function isTabelaInexistente(err: unknown): boolean {
  const e = err as { code?: string; message?: string; status?: number }
  if (e?.code === 'PGRST205') return true
  const msg = String(e?.message ?? '').toLowerCase()
  return msg.includes('could not find the table') || e?.status === 404
}

export function useEstatisticasMercado(empresaId: string | null, categoriaEmpresa: string, periodo: Periodo) {
  const [segmentosGuia, setSegmentosGuia] = useState<DadosSegmentosGuia[]>([])
  const [segmentosRecomendados, setSegmentosRecomendados] = useState<DadosSegmentosRecomendados[]>([])
  const [atendimentosCategoria, setAtendimentosCategoria] = useState<DadosAtendimentosCategoria[]>([])
  const [distribuicaoProfissionais, setDistribuicaoProfissionais] = useState<DadosDistribuicaoProfissionais[]>([])
  const [comissaoRamo, setComissaoRamo] = useState<DadosComissaoRamo[]>([])
  const [crescimentoUsuarios, setCrescimentoUsuarios] = useState<DadosCrescimentoUsuarios[]>([])
  const [ocupacaoHoteleira, setOcupacaoHoteleira] = useState<DadosOcupacaoHoteleira[]>([])
  const [historicoAtendimentos, setHistoricoAtendimentos] = useState<DadosHistoricoAtendimentos[]>([])
  const [horariosPico, setHorariosPico] = useState<DadosHorariosPico[]>([])
  const [analiseMercado, setAnaliseMercado] = useState<AnaliseMercadoDados>(() => ({
    visibilidade: preencherContagensSegmento({}),
    engajamento: preencherContagensSegmento({}),
    recomendados: preencherContagensSegmento({}),
    comissao: preencherComissaoSegmento({}),
    comissaoEmpresa: { media: 0, quantidade: 0 },
  }))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const dataLimite = useMemo(() => getDataLimite(periodo), [periodo])

  const fetchDados = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 1) Segmentos mais usados no guia (logs_cliques_guia)
      try {
        let q = supabase.from('logs_cliques_guia').select('categoria, created_at')
        if (dataLimite) q = q.gte('created_at', dataLimite)
        const { data, error: e } = await q
        if (e) {
          if (isTabelaInexistente(e)) {
            setSegmentosGuia([])
          } else {
            throw e
          }
        } else {
          const agg: Record<string, number> = {}
          for (const row of (data ?? []) as unknown[]) {
            const r = row as Record<string, unknown>
            const cat = r.categoria != null ? String(r.categoria) : ''
            if (!cat) continue
            agg[cat] = (agg[cat] ?? 0) + 1
          }
          const total = Object.values(agg).reduce((a, b) => a + b, 0)
          const arr: DadosSegmentosGuia[] = Object.entries(agg)
            .map(([categoria, t]) => ({ categoria, total: t, percentual: total ? (t / total) * 100 : 0 }))
            .sort((a, b) => b.total - a.total)
          setSegmentosGuia(arr)
        }
      } catch {
        setSegmentosGuia([])
      }

      // 2) Segmentos recomendados (logs_recomendacoes_segmento)
      try {
        let q = supabase.from('logs_recomendacoes_segmento').select('segmento, created_at')
        if (dataLimite) q = q.gte('created_at', dataLimite)
        const { data, error: e } = await q
        if (e) {
          if (isTabelaInexistente(e)) {
            setSegmentosRecomendados([])
          } else {
            throw e
          }
        } else {
          const agg: Record<string, number> = {}
          for (const row of (data ?? []) as unknown[]) {
            const r = row as Record<string, unknown>
            const seg = r.segmento != null ? String(r.segmento) : ''
            if (!seg) continue
            agg[seg] = (agg[seg] ?? 0) + 1
          }
          const total = Object.values(agg).reduce((a, b) => a + b, 0)
          const arr: DadosSegmentosRecomendados[] = Object.entries(agg)
            .map(([segmento, t]) => ({ segmento, total: t, percentual: total ? (t / total) * 100 : 0 }))
            .sort((a, b) => b.total - a.total)
          setSegmentosRecomendados(arr)
        }
      } catch {
        setSegmentosRecomendados([])
      }

      // 3) Atendimentos por categoria (solicitacao_mobilidade + profissionais.categoria/categorias)
      try {
        let q = supabase
          .from('solicitacao_mobilidade')
          .select(
            `
            created_at,
            profissionais:profissional_id (categoria, categorias)
          `
          )
        if (dataLimite) q = q.gte('created_at', dataLimite)
        const { data, error: e } = await q
        if (e) {
          if (isTabelaInexistente(e)) {
            setAtendimentosCategoria([])
          } else {
            throw e
          }
        } else {
          const agg: Record<string, number> = {}
          for (const row of (data ?? []) as unknown[]) {
            const r = row as Record<string, unknown>
            const p = r.profissionais
            const prof = p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null
            const categoria =
              (prof?.categoria != null ? String(prof.categoria) : '') || asStringArray(prof?.categorias)[0] || 'outros'
            agg[categoria] = (agg[categoria] ?? 0) + 1
          }
          const total = Object.values(agg).reduce((a, b) => a + b, 0)
          const arr: DadosAtendimentosCategoria[] = Object.entries(agg)
            .map(([categoria, t]) => ({ categoria, total: t, percentual: total ? (t / total) * 100 : 0 }))
            .sort((a, b) => b.total - a.total)
          setAtendimentosCategoria(arr)
        }
      } catch {
        setAtendimentosCategoria([])
      }

      // 4) Distribuição de profissionais por tipo e cidade (agregado)
      try {
        const { data, error: e } = await supabase.from('profissionais').select('categorias, cidade_atuacao')
        if (e) throw e

        const agg: Record<string, number> = {}
        for (const row of (data ?? []) as unknown[]) {
          const r = row as Record<string, unknown>
          const cats = asStringArray(r.categorias)
          const cidades = asStringArray(r.cidade_atuacao)
          for (const c of cats.length ? cats : ['outros']) {
            for (const cidade of cidades.length ? cidades : ['-']) {
              const k = `${c}||${cidade}`
              agg[k] = (agg[k] ?? 0) + 1
            }
          }
        }
        const arr: DadosDistribuicaoProfissionais[] = Object.entries(agg).map(([k, total]) => {
          const [tipo, cidade] = k.split('||')
          return { tipo, cidade, total }
        })
        setDistribuicaoProfissionais(arr)
      } catch {
        setDistribuicaoProfissionais([])
      }

      // 5) Média de comissão por ramo (taxas_comissoes)
      try {
        const { data, error: e } = await supabase.from('taxas_comissoes').select('categoria, taxa_percentual')
        if (e) {
          if (isTabelaInexistente(e)) {
            setComissaoRamo([])
          } else {
            throw e
          }
        } else {
          const arr: DadosComissaoRamo[] = (data ?? []).map((row) => {
            const r = row as Record<string, unknown>
            const ramo = r.categoria != null ? String(r.categoria) : ''
            const media = r.taxa_percentual != null ? Number(r.taxa_percentual) : 0
            return {
              ramo,
              media: Number.isFinite(media) ? media : 0,
              sua_comissao: ramo && ramo === categoriaEmpresa ? (Number.isFinite(media) ? media : 0) : 0,
            }
          })
          setComissaoRamo(arr)
        }
      } catch {
        setComissaoRamo([])
      }

      // 6) Crescimento de usuários por mês (usuarios.created_at)
      try {
        const min = dataLimite ?? new Date(new Date().getFullYear() - 1, 0, 1).toISOString()
        const { data, error: e } = await supabase.from('usuarios').select('role, created_at').gte('created_at', min)
        if (e) throw e

        const agg: Record<string, { turistas: number; profissionais: number; empresas: number }> = {}
        for (const row of (data ?? []) as unknown[]) {
          const r = row as Record<string, unknown>
          const dt = safeIso(r.created_at)
          if (!dt) continue
          const key = monthKeyPtBR(dt)
          const role = r.role != null ? String(r.role) : ''
          if (!agg[key]) agg[key] = { turistas: 0, profissionais: 0, empresas: 0 }
          if (role === 'turista') agg[key].turistas += 1
          else if (role === 'profissional') agg[key].profissionais += 1
          else if (role === 'empresa') agg[key].empresas += 1
        }
        const arr: DadosCrescimentoUsuarios[] = Object.keys(agg)
          .sort()
          .map((k) => ({ mes: monthLabelPtBR(k), ...agg[k] }))
        setCrescimentoUsuarios(arr)
      } catch {
        setCrescimentoUsuarios([])
      }

      // 7) Ocupação hoteleira agregada (reservas)
      try {
        const min = dataLimite ?? new Date(new Date().getFullYear() - 1, 0, 1).toISOString()
        const { data, error: e } = await supabase.from('reservas').select('data_checkin').gte('data_checkin', min)
        if (e) {
          if (isTabelaInexistente(e)) {
            setOcupacaoHoteleira([])
          } else {
            throw e
          }
        } else {
          const agg: Record<string, number> = {}
          for (const row of (data ?? []) as unknown[]) {
            const r = row as Record<string, unknown>
            const dt = safeIso(r.data_checkin)
            if (!dt) continue
            const k = monthKeyPtBR(dt)
            agg[k] = (agg[k] ?? 0) + 1
          }
          const arr: DadosOcupacaoHoteleira[] = Object.keys(agg)
            .sort()
            .map((k) => {
              const total = agg[k]
              return { mes: monthLabelPtBR(k), ocupacao: Math.max(0, Math.min(Number(total) * 5, 100)) }
            })
          setOcupacaoHoteleira(arr)
        }
      } catch {
        setOcupacaoHoteleira([])
      }

      // 8) Histórico de atendimentos (solicitacao_mobilidade por mês)
      try {
        const min = dataLimite ?? new Date(new Date().getFullYear() - 1, 0, 1).toISOString()
        let q = supabase.from('solicitacao_mobilidade').select('created_at').gte('created_at', min)
        const { data, error: e } = await q
        if (e) {
          if (isTabelaInexistente(e)) {
            setHistoricoAtendimentos([])
          } else {
            throw e
          }
        } else {
          const agg: Record<string, number> = {}
          for (const row of (data ?? []) as unknown[]) {
            const r = row as Record<string, unknown>
            const dt = safeIso(r.created_at)
            if (!dt) continue
            const k = monthKeyPtBR(dt)
            agg[k] = (agg[k] ?? 0) + 1
          }
          const arr: DadosHistoricoAtendimentos[] = Object.keys(agg)
            .sort()
            .map((k) => ({ mes: monthLabelPtBR(k), valor: agg[k] }))
          setHistoricoAtendimentos(arr)
        }
      } catch {
        setHistoricoAtendimentos([])
      }

      // 9) Horários de pico (placeholder, por enquanto)
      setHorariosPico([
        { hora: 8, total: 15 },
        { hora: 10, total: 25 },
        { hora: 12, total: 35 },
        { hora: 14, total: 30 },
        { hora: 16, total: 40 },
        { hora: 18, total: 45 },
        { hora: 20, total: 32 },
      ])

      try {
        const analise = await buscarAnaliseMercado(dataLimite, empresaId)
        setAnaliseMercado(analise)
      } catch {
        setAnaliseMercado({
          visibilidade: preencherContagensSegmento({}),
          engajamento: preencherContagensSegmento({}),
          recomendados: preencherContagensSegmento({}),
          comissao: preencherComissaoSegmento({}),
          comissaoEmpresa: { media: 0, quantidade: 0 },
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar estatísticas'))
    } finally {
      setLoading(false)
    }
  }, [categoriaEmpresa, dataLimite, empresaId])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  return {
    segmentosGuia,
    segmentosRecomendados,
    atendimentosCategoria,
    distribuicaoProfissionais,
    comissaoRamo,
    crescimentoUsuarios,
    ocupacaoHoteleira,
    historicoAtendimentos,
    horariosPico,
    analiseMercado,
    loading,
    error,
    refetch: fetchDados,
  }
}

