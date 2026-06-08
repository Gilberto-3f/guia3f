'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  BarChart3,
  Filter,
  Info,
  MapPin,
  Search,
  TrendingUp,
} from 'lucide-react'
import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'
import { useEstatisticasMercado } from '../../hooks/useEstatisticasMercado'
import { useFunilEcossistemaAgregado } from '../../hooks/useFunilEcossistemaAgregado'
import type { Periodo } from '../../types/dashboard.types'
import {
  agregarCalendarioAtendimentos,
  agregarCalendarioHospedagem,
  agregarTaxaAtendimentoAnual,
  agregarTaxaOcupacaoAnual,
} from '@/lib/projecaoDemanda'

import PastaEstatistica from './PastaEstatistica'
import AnaliseMercadoPainel from './AnaliseMercadoPainel'
import FunilEcossistemaMercado from './FunilEcossistemaMercado'
import MobilidadeRegionalPainel from './MobilidadeRegionalPainel'
import ProjecaoDemandaPainel from './ProjecaoDemandaPainel'
import OtimizacaoMotorBuscaPainel from './OtimizacaoMotorBuscaPainel'
import ExportarRelatorio from '../shared/ExportarRelatorio'

interface Props {
  periodo: Periodo
}

function flattenCalendario(meses: ReturnType<typeof agregarCalendarioHospedagem>) {
  return meses.flatMap((mes) =>
    mes.dias.map((dia) => ({
      mes: mes.mesLabelLongo,
      data: dia.data,
      dia: dia.dia,
      nivel: dia.nivel,
      valor: dia.valor,
      confirmado: dia.confirmado,
    })),
  )
}

export default function EstatisticasMercado({ periodo }: Props) {
  const { dados: empresa } = useDashboardEmpresa()
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)

  const categoriaEmpresa = empresa?.categoria ?? ''
  const empresaId = empresa?.id ?? null

  const funilEco = useFunilEcossistemaAgregado(periodo)

  const {
    atendimentosCategoria,
    distribuicaoProfissionais,
    atendimentosMobilidade,
    profissionaisCategorias,
    analiseMercado,
    topTermosBuscaGuia,
    reservasHospedagem,
    atendimentosProjecao,
    loading,
    error,
  } = useEstatisticasMercado(empresaId, categoriaEmpresa, periodo)

  const togglePasta = (id: string) => {
    setPastaAberta((atual) => (atual === id ? null : id))
  }

  const comissaoEmpresa = analiseMercado.comissaoEmpresa

  const totalAtendimentosPeriodo = useMemo(
    () => atendimentosCategoria.reduce((sum, a) => sum + a.total, 0),
    [atendimentosCategoria],
  )

  const exportDados = useMemo(() => {
    const ano = new Date().getFullYear()
    const calendarioHosp = agregarCalendarioHospedagem(reservasHospedagem)
    const calendarioAtend = agregarCalendarioAtendimentos(atendimentosProjecao)

    return {
      metadados: {
        exportado_em: new Date().toISOString(),
        periodo,
        categoria_empresa: categoriaEmpresa,
        empresa: empresa?.nome ?? '',
      },
      resumo: {
        atendimentos_periodo: totalAtendimentosPeriodo,
        comissao_empresa_pax: comissaoEmpresa.mediaPax,
        comissao_empresa_percentual: comissaoEmpresa.mediaPercentual,
        comissao_empresa_indicacao: comissaoEmpresa.mediaIndicacao,
      },
      funil_ecossistema: funilEco.dados,
      funil_ecossistema_recomendacoes_categoria: funilEco.recomendacoesPorCategoria,
      analise_mercado_visibilidade: analiseMercado.visibilidade,
      analise_mercado_engajamento: analiseMercado.engajamento,
      analise_mercado_recomendados: analiseMercado.recomendados,
      analise_mercado_comissao: analiseMercado.comissao,
      atendimentos_por_categoria: atendimentosCategoria,
      distribuicao_profissionais: distribuicaoProfissionais,
      projecao_calendario_hospedagem: flattenCalendario(calendarioHosp),
      projecao_calendario_atendimentos: flattenCalendario(calendarioAtend),
      historico_ocupacao_ano_atual: agregarTaxaOcupacaoAnual(reservasHospedagem, ano),
      historico_ocupacao_ano_anterior: agregarTaxaOcupacaoAnual(reservasHospedagem, ano - 1),
      historico_atendimento_ano_atual: agregarTaxaAtendimentoAnual(atendimentosProjecao, ano),
      historico_atendimento_ano_anterior: agregarTaxaAtendimentoAnual(atendimentosProjecao, ano - 1),
      reservas_hospedagem: reservasHospedagem,
      atendimentos_projecao: atendimentosProjecao,
      busca_guia_top_termos: topTermosBuscaGuia,
    }
  }, [
    analiseMercado,
    atendimentosCategoria,
    atendimentosProjecao,
    categoriaEmpresa,
    comissaoEmpresa,
    distribuicaoProfissionais,
    empresa?.nome,
    funilEco.dados,
    funilEco.recomendacoesPorCategoria,
    periodo,
    reservasHospedagem,
    topTermosBuscaGuia,
    totalAtendimentosPeriodo,
  ])

  const prepararExportacao = useCallback(async () => funilEco.obterDadosExportacao(), [funilEco])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
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
          <FunilEcossistemaMercado eco={funilEco} />
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
          <MobilidadeRegionalPainel
            distribuicaoProfissionais={distribuicaoProfissionais}
            profissionaisCategorias={profissionaisCategorias}
            atendimentosMobilidade={atendimentosMobilidade}
          />
        </PastaEstatistica>

        <PastaEstatistica
          id="projecao-demanda"
          titulo="Expectativa e Projeção de Demanda"
          icon={TrendingUp}
          controlado
          aberto={pastaAberta === 'projecao-demanda'}
          onToggle={() => togglePasta('projecao-demanda')}
        >
          <ProjecaoDemandaPainel
            reservasHospedagem={reservasHospedagem}
            atendimentosProjecao={atendimentosProjecao}
          />
        </PastaEstatistica>

        <PastaEstatistica
          id="otimizacao-busca"
          titulo="SEO - Otimização do Motor de Busca"
          icon={Search}
          controlado
          aberto={pastaAberta === 'otimizacao-busca'}
          onToggle={() => togglePasta('otimizacao-busca')}
        >
          <OtimizacaoMotorBuscaPainel topTermos={topTermosBuscaGuia} />
        </PastaEstatistica>
      </div>

      <div className="border-t border-gray-200 pt-3 pb-0">
        <ExportarRelatorio dados={exportDados} tipo="mercado" preparar={prepararExportacao} />
      </div>

      <div className="flex items-start justify-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
        <p>Dados anônimos e agregados. Nenhuma empresa é identificada individualmente.</p>
      </div>
    </div>
  )
}
