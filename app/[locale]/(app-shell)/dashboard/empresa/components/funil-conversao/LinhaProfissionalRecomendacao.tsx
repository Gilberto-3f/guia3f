'use client'

import { useMemo } from 'react'
import { formatarWhatsappTuristaMascarado } from '@/lib/recomendarEmpresa'
import type { RecomendacaoProfissional } from '../../types/dashboard.types'
import { formatarDataCurta, formatarHora } from './formatarDataHora'
import LinhaProfissionalCabecalho from './LinhaProfissionalCabecalho'

interface Props {
  profissional: RecomendacaoProfissional
  naoLidas?: number
}

export default function LinhaProfissionalRecomendacao({ profissional, naoLidas = 0 }: Props) {
  const recomendacoesOrdenadas = useMemo(
    () =>
      [...profissional.detalhes].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [profissional.detalhes],
  )

  return (
    <LinhaProfissionalCabecalho
      profissionalId={profissional.profissional_id}
      nome={profissional.profissional_nome}
      username={profissional.profissional_username}
      fotoUrl={profissional.profissional_foto_url}
      verificado={profissional.profissional_verificado}
      naoLidas={naoLidas}
    >
      <div className="space-y-3">
        {recomendacoesOrdenadas.map((detalhe, index) => {
          const whatsapp = formatarWhatsappTuristaMascarado(
            detalhe.turista_whatsapp_ddd,
            detalhe.turista_whatsapp_final,
          )

          return (
            <div
              key={detalhe.id}
              className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Recomendação {index + 1}
              </p>
              <p className="mt-1 text-sm text-gray-800">
                {formatarDataCurta(detalhe.created_at)} · {formatarHora(detalhe.created_at)}
              </p>
              {whatsapp ? (
                <p className="mt-0.5 text-sm tabular-nums text-gray-600">{whatsapp}</p>
              ) : (
                <p className="mt-0.5 text-sm text-gray-400">WhatsApp turista não informado</p>
              )}
            </div>
          )
        })}
      </div>
    </LinhaProfissionalCabecalho>
  )
}
