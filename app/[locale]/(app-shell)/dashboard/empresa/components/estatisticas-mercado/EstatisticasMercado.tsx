'use client'

import { useMemo, useState } from 'react'
import {
  BarChart3,
  Building2,
  Clock,
  DollarSign,
  Info,
  Map,
  PieChart,
  TrendingUp,
  Users,
  UserSquare2,
} from 'lucide-react'
import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'
import { useEstatisticasMercado } from '../../hooks/useEstatisticasMercado'
import type { Periodo } from '../../types/dashboard.types'

import GraficoBarras from './GraficoBarras'
import GraficoPizza from './GraficoPizza'
import GraficoLinha from './GraficoLinha'
import CardsResumo from './CardsResumo'
import MapaCalor from './MapaCalor'
import HorariosPico from './HorariosPico'
import PastaEstatistica from './PastaEstatistica'
import ExportarRelatorio from '../shared/ExportarRelatorio'

interface Props {
  periodo: Periodo
}

function normalizeTipoLabel(tipo: string) {
  const t = tipo.toLowerCase()
  if (t.includes('guia')) return 'Guias de Turismo'
  if (t.includes('taxi')) return 'Taxistas'
  if (t.includes('van')) return 'Motoristas de Van'
  if (t.includes('app')) return 'Motoristas de App'
  if (t.includes('anfit')) return 'Anfitriões'
  return tipo
}

export default function EstatisticasMercado({ periodo }: Props) {
  const { dados: empresa } = useDashboardEmpresa()
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)

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

  const togglePasta = (id: string) => {
    setPastaAberta((atual) => (atual === id ? null : id))
  }

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
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
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
    <div className="space-y-4 pb-1">
      <CardsResumo
        mediaComissao={suaComissao}
        atendimentos={totalAtendimentosPeriodo}
        ocupacaoHoteleira={ocupacaoMediaPeriodo}
        categoriaEmpresa={categoriaEmpresa}
      />

      <div className="space-y-3">
        <PastaEstatistica
          id="segmentos-guia"
          titulo="Segmentos mais usados no guia"
          icon={BarChart3}
          controlado
          aberto={pastaAberta === 'segmentos-guia'}
          onToggle={() => togglePasta('segmentos-guia')}
        >
          <GraficoBarras
            dados={segmentosGuiaFormatados}
            titulo=""
            semTitulo
            embed
          />
        </PastaEstatistica>

        <PastaEstatistica
          id="segmentos-recomendados"
          titulo="Segmentos mais recomendados"
          icon={TrendingUp}
          controlado
          aberto={pastaAberta === 'segmentos-recomendados'}
          onToggle={() => togglePasta('segmentos-recomendados')}
        >
          <GraficoBarras dados={segmentosRecomendadosFormatados} titulo="" semTitulo embed />
        </PastaEstatistica>

        <PastaEstatistica
          id="atendimentos-categoria"
          titulo="Atendimentos por categoria"
          icon={PieChart}
          controlado
          aberto={pastaAberta === 'atendimentos-categoria'}
          onToggle={() => togglePasta('atendimentos-categoria')}
        >
          <GraficoPizza dados={atendimentosFormatados} titulo="" semTitulo embed />
        </PastaEstatistica>

        <PastaEstatistica
          id="distribuicao-profissionais"
          titulo="Distribuição de profissionais"
          icon={Users}
          controlado
          aberto={pastaAberta === 'distribuicao-profissionais'}
          onToggle={() => togglePasta('distribuicao-profissionais')}
        >
          <GraficoPizza dados={profissionaisPorTipoFormatados} titulo="" semTitulo embed />
        </PastaEstatistica>

        <PastaEstatistica
          id="comissao-ramo"
          titulo="Média de comissão por ramo"
          icon={DollarSign}
          controlado
          aberto={pastaAberta === 'comissao-ramo'}
          onToggle={() => togglePasta('comissao-ramo')}
        >
          <GraficoBarras
            dados={comissaoFormatada}
            titulo=""
            semTitulo
            embed
            destaque={categoriaEmpresa}
            destaqueLabel={`Sua comissão: ${suaComissao}%`}
          />
        </PastaEstatistica>

        <PastaEstatistica
          id="crescimento-usuarios"
          titulo="Crescimento de usuários"
          icon={UserSquare2}
          controlado
          aberto={pastaAberta === 'crescimento-usuarios'}
          onToggle={() => togglePasta('crescimento-usuarios')}
        >
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Turistas</p>
              <GraficoLinha dados={crescimentoTuristas} titulo="" cor="#0097b2" semTitulo embed />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Profissionais</p>
              <GraficoLinha dados={crescimentoProfissionais} titulo="" cor="#00D443" semTitulo embed />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Empresas</p>
              <GraficoLinha dados={crescimentoEmpresas} titulo="" cor="#F1C40F" semTitulo embed />
            </div>
          </div>
        </PastaEstatistica>

        {categoriaEmpresa === 'Hospedagem' ? (
          <PastaEstatistica
            id="ocupacao-hoteleira"
            titulo="Ocupação hoteleira"
            icon={Building2}
            controlado
            aberto={pastaAberta === 'ocupacao-hoteleira'}
            onToggle={() => togglePasta('ocupacao-hoteleira')}
          >
            <GraficoLinha
              dados={ocupacaoHoteleira.map((o) => ({ mes: o.mes, valor: o.ocupacao }))}
              titulo=""
              cor="#E74C3C"
              semTitulo
              embed
            />
          </PastaEstatistica>
        ) : null}

        <PastaEstatistica
          id="mapa-calor"
          titulo="Mapa de calor — mobilidade"
          icon={Map}
          controlado
          aberto={pastaAberta === 'mapa-calor'}
          onToggle={() => togglePasta('mapa-calor')}
        >
          <MapaCalor semTitulo embed />
        </PastaEstatistica>

        <PastaEstatistica
          id="horarios-pico"
          titulo="Horários de pico"
          icon={Clock}
          controlado
          aberto={pastaAberta === 'horarios-pico'}
          onToggle={() => togglePasta('horarios-pico')}
        >
          <HorariosPico dados={horariosPico} semTitulo embed />
        </PastaEstatistica>
      </div>

      <div className="flex items-start justify-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
        <p>Dados anônimos e agregados. Nenhuma empresa é identificada individualmente.</p>
      </div>

      <div className="border-t border-gray-200 pt-3 pb-0">
        <ExportarRelatorio dados={exportDados} tipo="mercado" />
      </div>
    </div>
  )
}
