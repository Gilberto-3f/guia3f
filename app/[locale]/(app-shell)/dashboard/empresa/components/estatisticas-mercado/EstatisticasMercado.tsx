'use client'

import { useMemo, useState } from 'react'
import {
  BarChart3,
  Filter,
  Info,
  MapPin,
  TrendingUp,
} from 'lucide-react'
import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'
import { useEstatisticasMercado } from '../../hooks/useEstatisticasMercado'
import type { Periodo } from '../../types/dashboard.types'

import GraficoBarras from './GraficoBarras'
import GraficoPizza from './GraficoPizza'
import GraficoLinha from './GraficoLinha'
import MapaCalor from './MapaCalor'
import HorariosPico from './HorariosPico'
import PastaEstatistica from './PastaEstatistica'
import SubsecaoMercado from './SubsecaoMercado'
import AnaliseMercadoPainel from './AnaliseMercadoPainel'
import FunilEcossistemaMercado from './FunilEcossistemaMercado'
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
    atendimentosCategoria,
    distribuicaoProfissionais,
    analiseMercado,
    ocupacaoHoteleira,
    historicoAtendimentos,
    horariosPico,
    loading,
    error,
  } = useEstatisticasMercado(empresaId, categoriaEmpresa, periodo)

  const togglePasta = (id: string) => {
    setPastaAberta((atual) => (atual === id ? null : id))
  }

  const atendimentosFormatados = useMemo(
    () => atendimentosCategoria.map((a) => ({ label: a.categoria, valor: a.total, percentual: a.percentual })),
    [atendimentosCategoria],
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

  const profissionaisPorCidadeFormatados = useMemo(() => {
    const porCidade: Record<string, number> = {}
    for (const p of distribuicaoProfissionais) {
      const cidade = p.cidade?.trim() || 'Não informada'
      porCidade[cidade] = (porCidade[cidade] ?? 0) + (p.total ?? 0)
    }
    const total = Object.values(porCidade).reduce((a, b) => a + b, 0)
    return Object.entries(porCidade)
      .map(([label, valor]) => ({ label, valor, percentual: total ? (valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor)
  }, [distribuicaoProfissionais])

  const suaComissao = analiseMercado.comissaoEmpresa.media

  const totalAtendimentosPeriodo = useMemo(
    () => atendimentosCategoria.reduce((sum, a) => sum + a.total, 0),
    [atendimentosCategoria],
  )

  const exportDados = useMemo(
    () => ({
      periodo,
      categoria_empresa: categoriaEmpresa,
      media_comissao_setor: suaComissao,
      atendimentos_periodo: totalAtendimentosPeriodo,
    }),
    [categoriaEmpresa, periodo, suaComissao, totalAtendimentosPeriodo],
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
      <div className="space-y-3">
        <PastaEstatistica
          id="funil-ecossistema"
          titulo="Funil de conversão do Ecossistema"
          icon={Filter}
          controlado
          aberto={pastaAberta === 'funil-ecossistema'}
          onToggle={() => togglePasta('funil-ecossistema')}
        >
          <FunilEcossistemaMercado periodo={periodo} />
        </PastaEstatistica>

        <PastaEstatistica
          id="analise-mercado"
          titulo="Análise de Mercado"
          icon={BarChart3}
          controlado
          aberto={pastaAberta === 'analise-mercado'}
          onToggle={() => togglePasta('analise-mercado')}
        >
          <AnaliseMercadoPainel analise={analiseMercado} categoriaEmpresa={categoriaEmpresa} />
        </PastaEstatistica>

        <PastaEstatistica
          id="mobilidade-regional"
          titulo="Mobilidade Regional"
          icon={MapPin}
          controlado
          aberto={pastaAberta === 'mobilidade-regional'}
          onToggle={() => togglePasta('mobilidade-regional')}
        >
          <div className="space-y-5">
            <SubsecaoMercado titulo="Distribuição de profissionais (por tipo e cidade)">
              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Por tipo</p>
                  <GraficoPizza dados={profissionaisPorTipoFormatados} titulo="" semTitulo embed />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Por cidade</p>
                  <GraficoBarras dados={profissionaisPorCidadeFormatados} titulo="" semTitulo embed />
                </div>
              </div>
            </SubsecaoMercado>

            <SubsecaoMercado titulo="Atendimento por categoria">
              <GraficoPizza dados={atendimentosFormatados} titulo="" semTitulo embed />
            </SubsecaoMercado>

            <SubsecaoMercado titulo="Horário de pico (solicitações de atendimento)">
              <HorariosPico dados={horariosPico} semTitulo embed />
            </SubsecaoMercado>
          </div>
        </PastaEstatistica>

        <PastaEstatistica
          id="projecao-demanda"
          titulo="Expectativa e Projeção de Demanda"
          icon={TrendingUp}
          controlado
          aberto={pastaAberta === 'projecao-demanda'}
          onToggle={() => togglePasta('projecao-demanda')}
        >
          <div className="space-y-5">
            <SubsecaoMercado titulo="Ocupação de hospedagem">
              {ocupacaoHoteleira.length > 0 ? (
                <GraficoLinha
                  dados={ocupacaoHoteleira.map((o) => ({ mes: o.mes, valor: o.ocupacao }))}
                  titulo=""
                  cor="#E74C3C"
                  semTitulo
                  embed
                />
              ) : (
                <p className="text-sm text-gray-500">Sem dados de ocupação no período selecionado.</p>
              )}
            </SubsecaoMercado>

            <SubsecaoMercado titulo="Mapa de calor na região">
              <MapaCalor semTitulo embed />
            </SubsecaoMercado>

            <SubsecaoMercado titulo="Histórico de atendimentos">
              {historicoAtendimentos.length > 0 ? (
                <GraficoLinha
                  dados={historicoAtendimentos}
                  titulo=""
                  cor="#0097b2"
                  semTitulo
                  embed
                />
              ) : (
                <p className="text-sm text-gray-500">Sem histórico de atendimentos no período selecionado.</p>
              )}
            </SubsecaoMercado>
          </div>
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
