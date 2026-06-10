'use client'

import { useMemo } from 'react'
import { paraGraficoPizza } from '@/lib/segmentosMercado'
import type { MaisProcuradosTuristasDados } from '@/lib/adminMaisProcuradosTuristas'
import GraficoPizzaMercado from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/GraficoPizza'

export function MaisProcuradosEcossistemaPainel({ dados }: { dados: MaisProcuradosTuristasDados }) {
  const pizzaVisibilidade = useMemo(() => paraGraficoPizza(dados.visibilidade), [dados.visibilidade])
  const pizzaEngajamento = useMemo(() => paraGraficoPizza(dados.engajamento), [dados.engajamento])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GraficoPizzaMercado dados={pizzaVisibilidade} titulo="Visibilidade" embed semTitulo mostrarComZero />
        <GraficoPizzaMercado dados={pizzaEngajamento} titulo="Engajamento" embed semTitulo mostrarComZero />
      </div>
      <p className="text-center text-[11px] leading-relaxed text-gray-400">
        Visibilidade: visitas nas páginas das empresas por turistas. Engajamento: curtidas, comentários, reposts,
        salvos e avaliações feitas por turistas.
      </p>
    </div>
  )
}
