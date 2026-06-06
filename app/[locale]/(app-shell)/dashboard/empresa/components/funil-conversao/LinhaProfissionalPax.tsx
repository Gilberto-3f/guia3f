'use client'

import type { PaxProfissional } from '../../types/dashboard.types'
import { formatarDataHora } from './formatarDataHora'
import LinhaProfissionalCabecalho from './LinhaProfissionalCabecalho'

interface Props {
  profissional: PaxProfissional
  naoLidas?: number
}

export default function LinhaProfissionalPax({ profissional, naoLidas = 0 }: Props) {
  return (
    <LinhaProfissionalCabecalho
      profissionalId={profissional.profissional_id}
      nome={profissional.profissional_nome}
      username={profissional.profissional_username}
      fotoUrl={profissional.profissional_foto_url}
      verificado={profissional.profissional_verificado}
      naoLidas={naoLidas}
    >
      {profissional.detalhes.map((detalhe) => (
        <div key={detalhe.id} className="text-sm leading-relaxed text-gray-600">
          <p>{formatarDataHora(detalhe.created_at)}</p>
          <p className="text-gray-500">
            {detalhe.pax_qtd === 1 ? '1 passageiro' : `${detalhe.pax_qtd} passageiros`}
          </p>
        </div>
      ))}
    </LinhaProfissionalCabecalho>
  )
}
