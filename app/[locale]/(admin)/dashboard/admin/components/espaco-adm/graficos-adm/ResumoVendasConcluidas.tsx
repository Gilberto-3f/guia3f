'use client'

import type { VendasConcluidas } from '../../../hooks/useGraficosAdm'

function formatQtd(n: number) {
  return n.toLocaleString('pt-BR')
}

export function ResumoVendasConcluidas({ dados }: { dados: VendasConcluidas }) {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total no período</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{formatQtd(dados.total)}</p>
        <p className="text-xs text-gray-500">vendas concluídas pelo app</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
          <p className="text-xs font-semibold text-[#0097b2]">Mobilidade</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatQtd(dados.mobilidade)}</p>
          <p className="text-[11px] text-gray-500">serviços de profissionais</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
          <p className="text-xs font-semibold text-[#0097b2]">Guia turístico</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatQtd(dados.guia)}</p>
          <p className="text-[11px] text-gray-500">serviços de empresas</p>
        </div>
      </div>
    </div>
  )
}
