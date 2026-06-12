'use client'

import { useMemo, useState } from 'react'
import {
  BarChart3,
  Filter,
  Info,
  MapPin,
  Search,
  TrendingUp,
} from 'lucide-react'
import { useEstatisticasMercado } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useEstatisticasMercado'
import { useFunilEcossistemaAgregado } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useFunilEcossistemaAgregado'
import type { Periodo } from '@/app/[locale]/(app-shell)/dashboard/empresa/types/dashboard.types'
import PastaEstatistica from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/PastaEstatistica'
import AnaliseMercadoPainel from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/AnaliseMercadoPainel'
import FunilEcossistemaMercado from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/FunilEcossistemaMercado'
import MobilidadeRegionalPainel from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/MobilidadeRegionalPainel'
import ProjecaoDemandaPainel from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/ProjecaoDemandaPainel'
import OtimizacaoMotorBuscaPainel from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/OtimizacaoMotorBuscaPainel'
import { FiltroPeriodoCompacto } from '../../shared/FiltroPeriodoCompacto'
import type { PeriodoId } from '../../shared/FiltrosPeriodo'

function periodoParaMercado(periodo: PeriodoId): Periodo {
  if (periodo === '12m') return '90d'
  return periodo
}

export function EstatisticasMercado() {
  const [periodo, setPeriodo] = useState<PeriodoId>('30d')
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)

  const periodoMercado = periodoParaMercado(periodo)
  const funilEco = useFunilEcossistemaAgregado(periodoMercado)

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
  } = useEstatisticasMercado(null, '', periodoMercado)

  const togglePasta = (id: string) => {
    setPastaAberta((atual) => (atual === id ? null : id))
  }

  const totalAtendimentosPeriodo = useMemo(
    () => atendimentosCategoria.reduce((sum, a) => sum + a.total, 0),
    [atendimentosCategoria],
  )

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
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
        Erro ao carregar estatísticas: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <FiltroPeriodoCompacto value={periodo} onChange={setPeriodo} />
      </div>

      {periodo === '12m' ? (
        <p className="text-center text-xs text-gray-500">
          Período de 12 meses exibido com base nos últimos 90 dias disponíveis.
        </p>
      ) : null}

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
          <AnaliseMercadoPainel analise={analiseMercado} categoriaEmpresa="" />
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
            profissionaisMobilidade={profissionaisCategorias}
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

      <div className="flex items-start justify-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
        <p>
          {totalAtendimentosPeriodo > 0
            ? `${totalAtendimentosPeriodo} atendimentos de mobilidade no período. Dados anônimos e agregados.`
            : 'Dados anônimos e agregados. Nenhuma empresa é identificada individualmente.'}
        </p>
      </div>

    </div>
  )
}
