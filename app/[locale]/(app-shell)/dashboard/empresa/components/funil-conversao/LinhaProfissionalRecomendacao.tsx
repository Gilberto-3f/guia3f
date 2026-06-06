'use client'

import type { RecomendacaoProfissional } from '../../types/dashboard.types'
import { formatarDataHora } from './formatarDataHora'
import LinhaProfissionalCabecalho from './LinhaProfissionalCabecalho'

interface Props {
  profissional: RecomendacaoProfissional
  naoLidas?: number
}

export default function LinhaProfissionalRecomendacao({ profissional, naoLidas = 0 }: Props) {
  return (
    <LinhaProfissionalCabecalho
      profissionalId={profissional.profissional_id}
      nome={profissional.profissional_nome}
      username={profissional.profissional_username}
      fotoUrl={profissional.profissional_foto_url}
      naoLidas={naoLidas}
    >
      {profissional.detalhes.map((detalhe) => (
        <div key={detalhe.id} className="text-sm leading-relaxed text-gray-600">
          <p>{formatarDataHora(detalhe.created_at)}</p>
          {detalhe.turista_whatsapp_final ? (
            <p className="text-gray-500">WhatsApp turista ····{detalhe.turista_whatsapp_final}</p>
          ) : (
            <p className="text-gray-400">WhatsApp turista não informado</p>
          )}
        </div>
      ))}
    </LinhaProfissionalCabecalho>
  )
}
