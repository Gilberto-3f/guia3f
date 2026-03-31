'use client'

import { useMemo } from 'react'
import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'
import { useEstatisticasMercado } from '../../hooks/useEstatisticasMercado'
import type { Periodo } from '../../types/dashboard.types'

import GraficoBarras from './GraficoBarras'
import GraficoPizza from './GraficoPizza'
import GraficoLinha from './GraficoLinha'
import CardsResumo from './CardsResumo'
import MapaCalor from './MapaCalor'
import HorariosPico from './HorariosPico'
import ExportarRelatorio from '../shared/ExportarRelatorio'

interface Props {
  periodo: Periodo
}

function normalizeTipoLabel(tipo: string) {
  const t = tipo.toLowerCase()
  if (t.includes('guia')) return '🚐 Guias'
  if (t.includes('taxi')) return '🚕 Taxistas'
  if (t.includes('van')) return '🚌 Vans'
  if (t.includes('app')) return '📱 Apps'
  if (t.includes('anfit')) return '🏨 Anfitriões'
  return tipo
}

export default function EstatisticasMercado({ periodo }: Props) {
  const { dados: empresa } = useDashboardEmpresa()

  const categoriaEmpresa = empresa?.categoria ?? ''
  const empresaId = empresa?.id ?? null

  const {
    segmentosGuia,
    segmentosRecomendados,
    atendimentosCategoria,
    distribuicaoProfissionais,
    comissaoRamo,
    crescimentoUsuarios,
    ocupacaoHoteleira,
    horariosPico,
    loading,
    error,
  } = useEstatisticasMercado(empresaId, categoriaEmpresa, periodo)

  const segmentosGuiaFormatados = useMemo(
    () => segmentosGuia.map((s) => ({ label: s.categoria, valor: s.total, percentual: s.percentual })),
    [segmentosGuia]
  )
  const segmentosRecomendadosFormatados = useMemo(
    () => segmentosRecomendados.map((s) => ({ label: s.segmento, valor: s.total, percentual: s.percentual })),
    [segmentosRecomendados]
  )
  const atendimentosFormatados = useMemo(
    () => atendimentosCategoria.map((a) => ({ label: a.categoria, valor: a.total, percentual: a.percentual })),
    [atendimentosCategoria]
  )

  const profissionaisPorTipoFormatados = useMemo(() => {
    const porTipo: Record<string, number> = {}
    for (const p of distribuicaoProfissionais) {
      const k = normalizeTipoLabel(p.tipo)
      porTipo[k] = (porTipo[k] ?? 0) + (p.total ?? 0)
    }
    const total = Object.values(porTipo).reduce((a, b) => a + b, 0)
    return Object.entries(porTipo)
      .map(([label, valor]) => ({ label, valor, percentual: total ? (valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor)
  }, [distribuicaoProfissionais])

  const crescimentoTuristas = useMemo(
    () => crescimentoUsuarios.map((c) => ({ mes: c.mes, valor: c.turistas })),
    [crescimentoUsuarios]
  )
  const crescimentoProfissionais = useMemo(
    () => crescimentoUsuarios.map((c) => ({ mes: c.mes, valor: c.profissionais })),
    [crescimentoUsuarios]
  )
  const crescimentoEmpresas = useMemo(
    () => crescimentoUsuarios.map((c) => ({ mes: c.mes, valor: c.empresas })),
    [crescimentoUsuarios]
  )

  const comissaoFormatada = useMemo(
    () => comissaoRamo.map((c) => ({ label: c.ramo, valor: c.media })),
    [comissaoRamo]
  )
  const suaComissao = useMemo(() => {
    const hit = comissaoRamo.find((c) => c.ramo === categoriaEmpresa)
    return hit?.media ?? 0
  }, [categoriaEmpresa, comissaoRamo])

  const totalAtendimentosPeriodo = useMemo(
    () => atendimentosCategoria.reduce((sum, a) => sum + a.total, 0),
    [atendimentosCategoria]
  )

  const ocupacaoMediaPeriodo = useMemo(() => {
    if (ocupacaoHoteleira.length === 0) return null
    const last = ocupacaoHoteleira[ocupacaoHoteleira.length - 1]
    return last?.ocupacao ?? null
  }, [ocupacaoHoteleira])

  const exportDados = useMemo(
    () => ({
      periodo,
      categoria_empresa: categoriaEmpresa,
      media_comissao_setor: suaComissao,
      atendimentos_periodo: totalAtendimentosPeriodo,
    }),
    [categoriaEmpresa, periodo, suaComissao, totalAtendimentosPeriodo]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-800">
        Erro ao carregar estatísticas: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CardsResumo
        mediaComissao={suaComissao}
        atendimentos={totalAtendimentosPeriodo}
        ocupacaoHoteleira={ocupacaoMediaPeriodo}
        categoriaEmpresa={categoriaEmpresa}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GraficoBarras dados={segmentosGuiaFormatados} titulo="📊 Segmentos mais usados por turistas no guia" />
        <GraficoBarras dados={segmentosRecomendadosFormatados} titulo="📊 Segmentos mais recomendados por profissionais" />
        <GraficoPizza dados={atendimentosFormatados} titulo="📊 Atendimentos por categoria profissional" />
        <GraficoPizza dados={profissionaisPorTipoFormatados} titulo="📊 Distribuição de profissionais por tipo" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GraficoBarras
          dados={comissaoFormatada}
          titulo="💰 Média de comissão por ramo"
          destaque={categoriaEmpresa}
          destaqueLabel={`Sua comissão: ${suaComissao}%`}
        />

        <div className="space-y-6">
          <GraficoLinha dados={crescimentoTuristas} titulo="📈 Crescimento de Turistas" cor="#0097b2" />
          <GraficoLinha dados={crescimentoProfissionais} titulo="📈 Crescimento de Profissionais" cor="#00D443" />
          <GraficoLinha dados={crescimentoEmpresas} titulo="📈 Crescimento de Empresas" cor="#F1C40F" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {categoriaEmpresa === 'Hospedagem' ? (
          <GraficoLinha
            dados={ocupacaoHoteleira.map((o) => ({ mes: o.mes, valor: o.ocupacao }))}
            titulo="🏨 Ocupação Hoteleira por Mês"
            cor="#E74C3C"
          />
        ) : null}

        <MapaCalor />
        <HorariosPico dados={horariosPico} />
      </div>

      <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
        ℹ️ Dados anônimos e agregados. Nenhuma empresa é identificada individualmente.
      </div>

      <div className="border-t border-gray-200 pt-4">
        <ExportarRelatorio dados={exportDados} tipo="mercado" />
      </div>
    </div>
  )
}

