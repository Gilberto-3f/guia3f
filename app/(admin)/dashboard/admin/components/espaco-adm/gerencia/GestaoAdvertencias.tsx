'use client'

import ConfigInfracoes from '../../infracoes/ConfigInfracoes'

export function GestaoAdvertencias() {
  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-gray-900">Gestão de advertências e infrações</div>
      <div className="text-xs text-gray-600">
        Tabela de referência, cadastro de novas infrações, escalonamento e alertas preventivos.
      </div>
      <ConfigInfracoes />
    </div>
  )
}

