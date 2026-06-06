'use client'

import type { VendaProfissional } from '../../types/dashboard.types'
import { formatarDataHora } from './formatarDataHora'
import LinhaProfissionalCabecalho from './LinhaProfissionalCabecalho'

function formatarValor(valor: number | null) {
  if (valor == null || !Number.isFinite(valor)) return 'Valor não informado'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  profissional: VendaProfissional
  naoLidas?: number
}

export default function LinhaProfissionalVenda({ profissional, naoLidas = 0 }: Props) {
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
          <p className="text-gray-500">{formatarValor(detalhe.valor)}</p>
        </div>
      ))}
    </LinhaProfissionalCabecalho>
  )
}
