'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buscarAnaliseMercado, type AnaliseMercadoDados } from '@/lib/estatisticasMercadoAnalise'
import { buscarTopTermosGuia, type TopTermosSegmentoGuia } from '@/lib/buscasGuia'
import { preencherContagensSegmento, preencherComissaoSegmento } from '@/lib/segmentosMercado'
import type { AtendimentoMobilidadeRow } from '@/lib/mobilidadeRegional'
import { reservaLegadaParaHospedagem } from '@/lib/projecaoDemanda'
import type {
  AtendimentoProjecaoRow,
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
  ReservaHospedagemRow,
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

function isColunaInexistente(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? '').toLowerCase()
  return msg.includes('column') || msg.includes('does not exist') || msg.includes('could not find')
}

function processarSolicitacaoMobilidade(data: unknown[] | null) {
  const agg: Record<string, number> = {}
  const rowsMobilidade: AtendimentoMobilidadeRow[] = []
  const rowsProjecao: AtendimentoProjecaoRow[] = []
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const p = r.profissionais
    const prof = p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null
    const categoria =
      (prof?.categoria != null ? String(prof.categoria) : '') || asStringArray(prof?.categorias)[0] || 'outros'
    const cidades = asStringArray(prof?.cidade_atuacao)
    const createdAt = r.created_at != null ? String(r.created_at) : ''
    const status = r.status != null ? String(r.status) : ''
    agg[categoria] = (agg[categoria] ?? 0) + 1
    rowsMobilidade.push({ categoria, cidades, createdAt, status })
    rowsProjecao.push({
      categoria,
      cidades,
      createdAt,
      status,
      tipoServico: r.tipo_servico != null ? String(r.tipo_servico) : 'mobilidade',
      dataAgendada: r.data_agendada != null ? String(r.data_agendada) : null,
      latOrigem: r.lat_origem != null ? Number(r.lat_origem) : null,
      lngOrigem: r.lng_origem != null ? Number(r.lng_origem) : null,
      latDestino: r.lat_destino != null ? Number(r.lat_destino) : null,
      lngDestino: r.lng_destino != null ? Number(r.lng_destino) : null,
      regiao: r.regiao != null ? String(r.regiao) : null,
    })
  }
  const total = Object.values(agg).reduce((a, b) => a + b, 0)
  const arr: DadosAtendimentosCategoria[] = Object.entries(agg)
    .map(([categoria, t]) => ({ categoria, total: t, percentual: total ? (t / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)
  return { arr, rowsMobilidade, rowsProjecao }
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
  const [atendimentosMobilidade, setAtendimentosMobilidade] = useState<AtendimentoMobilidadeRow[]>([])
  const [reservasHospedagem, setReservasHospedagem] = useState<ReservaHospedagemRow[]>([])
  const [atendimentosProjecao, setAtendimentosProjecao] = useState<AtendimentoProjecaoRow[]>([])
  const [profissionaisCategorias, setProfissionaisCategorias] = useState<
    { categorias: unknown; cidade_atuacao?: unknown }[]
  >([])
  const [analiseMercado, setAnaliseMercado] = useState<AnaliseMercadoDados>(() => ({
    visibilidade: preencherContagensSegmento({}),
    engajamento: preencherContagensSegmento({}),
    recomendados: preencherContagensSegmento({}),
    comissao: preencherComissaoSegmento({}),
    comissaoEmpresa: { mediaPax: 0, mediaPercentual: 0, mediaIndicacao: 0, quantidade: 0 },
  }))
  const [topTermosBuscaGuia, setTopTermosBuscaGuia] = useState<TopTermosSegmentoGuia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const dataLimite = useMemo(() => getDataLimite(periodo), [periodo])

  const fetchSolicitacaoMobilidade = useCallback(async () => {
    const minHistorico = new Date(new Date().getFullYear() - 2, 0, 1).toISOString()
    const selectCompleto = `
      created_at,
      status,
      data_agendada,
      tipo_servico,
      lat_origem,
      lng_origem,
      lat_destino,
      lng_destino,
      regiao,
      profissionais:profissional_id (categorias, cidade_atuacao)
    `
    const selectBasico = `
      created_at,
      status,
      profissionais:profissional_id (categorias, cidade_atuacao)
    `
    let q = supabase.from('solicitacao_mobilidade').select(selectCompleto).gte('created_at', minHistorico)
    const primeira = await q
    let dataRows: unknown[] | null = (primeira.data as unknown[] | null) ?? null
    let e = primeira.error
    if (e && isColunaInexistente(e)) {
      let qb = supabase.from('solicitacao_mobilidade').select(selectBasico).gte('created_at', minHistorico)
      const retry = await qb
      dataRows = (retry.data as unknown[] | null) ?? null
      e = retry.error
    }
    if (e) {
      if (isTabelaInexistente(e)) return null
      throw e
    }
    return dataRows
  }, [])

  const fetchReservasHospedagem = useCallback(async () => {
    const min = new Date(new Date().getFullYear() - 2, 0, 1).toISOString().slice(0, 10)
    const { data: dataHosp, error: eHosp } = await supabase
      .from('reservas_hospedagem')
      .select('data_checkin, data_checkout, status')
      .gte('data_checkin', min)

    if (!eHosp && dataHosp && dataHosp.length > 0) {
      return (dataHosp as Record<string, unknown>[]).map((r) => ({
        dataCheckin: String(r.data_checkin ?? ''),
        dataCheckout: String(r.data_checkout ?? ''),
        status: String(r.status ?? 'confirmada'),
      }))
    }

    const minIso = new Date(new Date().getFullYear() - 2, 0, 1).toISOString()
    const { data, error: e } = await supabase.from('reservas').select('data_checkin').gte('data_checkin', minIso)
    if (e) {
      if (isTabelaInexistente(e) || (eHosp && isTabelaInexistente(eHosp))) return []
      if (eHosp) throw eHosp
      throw e
    }

    const rows: ReservaHospedagemRow[] = []
    for (const row of (data ?? []) as unknown[]) {
      const r = row as Record<string, unknown>
      const dt = safeIso(r.data_checkin)
      if (!dt) continue
      rows.push(reservaLegadaParaHospedagem(dt.toISOString()))
    }
    return rows
  }, [])

  const fetchDados = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [mobilidadeRows, profissionaisRes, comissaoRes, reservasRows, analiseRes, buscasGuiaRes] =
        await Promise.allSettled([
        fetchSolicitacaoMobilidade(),
        supabase
          .from('profissionais')
          .select('categorias, cidade_atuacao, usuarios!profissionais_usuario_id_fkey(role)')
          .eq('usuarios.role', 'profissional'),
        supabase.from('taxas_comissoes').select('categoria, taxa_percentual'),
        fetchReservasHospedagem(),
        buscarAnaliseMercado(dataLimite, empresaId),
        buscarTopTermosGuia(dataLimite, 10),
      ])

      if (mobilidadeRows.status === 'fulfilled' && mobilidadeRows.value) {
        const { arr, rowsMobilidade, rowsProjecao } = processarSolicitacaoMobilidade(mobilidadeRows.value)
        setAtendimentosCategoria(arr)
        setAtendimentosMobilidade(rowsMobilidade)
        setAtendimentosProjecao(rowsProjecao)

        const minDt = dataLimite ? new Date(dataLimite) : new Date(new Date().getFullYear() - 1, 0, 1)
        const aggHist: Record<string, number> = {}
        for (const row of mobilidadeRows.value) {
          const r = row as Record<string, unknown>
          const dt = safeIso(r.created_at)
          if (!dt || dt < minDt) continue
          const k = monthKeyPtBR(dt)
          aggHist[k] = (aggHist[k] ?? 0) + 1
        }
        setHistoricoAtendimentos(
          Object.keys(aggHist)
            .sort()
            .map((k) => ({ mes: monthLabelPtBR(k), valor: aggHist[k] })),
        )
      } else {
        setAtendimentosCategoria([])
        setAtendimentosMobilidade([])
        setAtendimentosProjecao([])
        setHistoricoAtendimentos([])
      }

      if (profissionaisRes.status === 'fulfilled' && !profissionaisRes.value.error) {
        const data = profissionaisRes.value.data ?? []
        setProfissionaisCategorias(
          data.map((r) => {
            const row = r as Record<string, unknown>
            return {
              categorias: row.categorias,
              cidade_atuacao: row.cidade_atuacao,
            }
          }),
        )

        const agg: Record<string, number> = {}
        for (const row of data as unknown[]) {
          const r = row as Record<string, unknown>
          const cats = asStringArray(r.categorias)
          const cidades = asStringArray(r.cidade_atuacao)
          const catsUnicas = new Set<string>()
          for (const c of cats) {
            const norm = c.trim()
            if (norm) catsUnicas.add(norm)
          }
          const cidadesUnicas = new Set<string>()
          for (const cidade of cidades) {
            const norm = cidade.trim()
            if (norm) cidadesUnicas.add(norm)
          }
          for (const c of catsUnicas) {
            for (const cidade of cidadesUnicas) {
              const k = `${c}||${cidade}`
              agg[k] = (agg[k] ?? 0) + 1
            }
          }
        }
        setDistribuicaoProfissionais(
          Object.entries(agg).map(([k, total]) => {
            const [tipo, cidade] = k.split('||')
            return { tipo, cidade, total }
          }),
        )
      } else {
        setProfissionaisCategorias([])
        setDistribuicaoProfissionais([])
      }

      if (comissaoRes.status === 'fulfilled' && !comissaoRes.value.error) {
        setComissaoRamo(
          (comissaoRes.value.data ?? []).map((row) => {
            const r = row as Record<string, unknown>
            const ramo = r.categoria != null ? String(r.categoria) : ''
            const media = r.taxa_percentual != null ? Number(r.taxa_percentual) : 0
            return {
              ramo,
              media: Number.isFinite(media) ? media : 0,
              sua_comissao: ramo && ramo === categoriaEmpresa ? (Number.isFinite(media) ? media : 0) : 0,
            }
          }),
        )
      } else {
        setComissaoRamo([])
      }

      setSegmentosGuia([])
      setSegmentosRecomendados([])
      setCrescimentoUsuarios([])
      setOcupacaoHoteleira([])

      if (reservasRows.status === 'fulfilled') {
        setReservasHospedagem(reservasRows.value)
      } else {
        setReservasHospedagem([])
      }

      setHorariosPico(Array.from({ length: 24 }, (_, h) => ({ hora: h, total: 0 })))

      if (analiseRes.status === 'fulfilled') {
        setAnaliseMercado(analiseRes.value)
      } else {
        setAnaliseMercado({
          visibilidade: preencherContagensSegmento({}),
          engajamento: preencherContagensSegmento({}),
          recomendados: preencherContagensSegmento({}),
          comissao: preencherComissaoSegmento({}),
          comissaoEmpresa: { mediaPax: 0, mediaPercentual: 0, mediaIndicacao: 0, quantidade: 0 },
        })
      }

      if (buscasGuiaRes.status === 'fulfilled') {
        setTopTermosBuscaGuia(buscasGuiaRes.value)
      } else {
        setTopTermosBuscaGuia([])
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar estatísticas'))
    } finally {
      setLoading(false)
    }
  }, [categoriaEmpresa, dataLimite, empresaId, fetchReservasHospedagem, fetchSolicitacaoMobilidade])

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
    atendimentosMobilidade,
    reservasHospedagem,
    atendimentosProjecao,
    profissionaisCategorias,
    analiseMercado,
    topTermosBuscaGuia,
    loading,
    error,
    refetch: fetchDados,
  }
}

