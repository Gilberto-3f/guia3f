'use client'

import ConfigInfracoes from '../../infracoes/ConfigInfracoes'
import { ValidacaoDecisoesAdm } from './ValidacaoDecisoesAdm'

export function GestaoAdvertencias() {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-700">
          Validação de decisões
        </div>
        <p className="mb-3 text-xs text-gray-600">
          O ADM GERAL confirma ou recusa medidas graves (ex.: banimentos) solicitadas por outros
          administradores.
        </p>
        <ValidacaoDecisoesAdm />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-700">
          Tabela de infrações
        </div>
        <p className="mb-3 text-xs text-gray-600">
          Referência de advertências, escalonamento e alertas preventivos.
        </p>
        <ConfigInfracoes />
      </div>
    </div>
  )
}
