'use client'

import type { DadoBarras, DadoPizzaSegmento } from '../../types/admin.types'
import GraficoPizzaMercado from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/GraficoPizza'
import { GraficoBarras } from './GraficoBarras'

export function AtivosProfissionaisPainel({
  faixas,
  comunidades,
  loading,
}: {
  faixas: DadoPizzaSegmento[]
  comunidades: DadoBarras[] | null
  loading: boolean
}) {

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-center text-xs font-medium text-gray-500">Atividade nas últimas 72 horas</p>
        <GraficoPizzaMercado dados={faixas} titulo="" semTitulo embed mostrarComZero />
      </div>
      <div>
        <p className="mb-3 text-center text-xs font-medium text-gray-500">
          Disponibilidade por comunidade (profissionais ativos em 24h ÷ cadastrados na comunidade)
        </p>
        <GraficoBarras
          dados={comunidades}
          loading={false}
          title=""
          semTitulo
          emptyMessage="Nenhum profissional ativo nas comunidades no período."
        />
        <p className="mt-2 text-center text-[11px] leading-relaxed text-gray-400">
          Comunidades: Motoristas de App, Van, Taxistas, Guias de Turismo e Anfitriões. Valores em % de
          disponibilidade.
        </p>
      </div>
    </div>
  )
}
