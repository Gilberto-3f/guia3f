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

import PastaEstatistica from './PastaEstatistica'
import AnaliseMercadoPainel from './AnaliseMercadoPainel'
import FunilEcossistemaMercado from './FunilEcossistemaMercado'
import MobilidadeRegionalPainel from './MobilidadeRegionalPainel'
import ProjecaoDemandaPainel from './ProjecaoDemandaPainel'
import ExportarRelatorio from '../shared/ExportarRelatorio'

interface Props {
  periodo: Periodo
}

export default function EstatisticasMercado({ periodo }: Props) {
  const { dados: empresa } = useDashboardEmpresa()
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)

  const categoriaEmpresa = empresa?.categoria ?? ''
  const empresaId = empresa?.id ?? null

  const {
    atendimentosCategoria,
    distribuicaoProfissionais,
    atendimentosMobilidade,
    analiseMercado,
    reservasHospedagem,
    atendimentosProjecao,
    loading,
    error,
  } = useEstatisticasMercado(empresaId, categoriaEmpresa, periodo)

  const togglePasta = (id: string) => {
    setPastaAberta((atual) => (atual === id ? null : id))
  }

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
          <MobilidadeRegionalPainel
            distribuicaoProfissionais={distribuicaoProfissionais}
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
