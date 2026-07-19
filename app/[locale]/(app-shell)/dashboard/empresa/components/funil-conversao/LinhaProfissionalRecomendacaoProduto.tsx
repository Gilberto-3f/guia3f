'use client'

import { useMemo } from 'react'
import { Mail } from 'lucide-react'
import IconWhatsApp from '@/components/IconWhatsApp'
import {
  formatarEmailTuristaMascarado,
  formatarWhatsappTuristaMascarado,
} from '@/lib/recomendarEmpresa'
import type { RecomendacaoProdutoProfissional } from '../../types/dashboard.types'
import { formatarDataCurta, formatarHora } from './formatarDataHora'
import LinhaProfissionalCabecalho from './LinhaProfissionalCabecalho'

interface Props {
  profissional: RecomendacaoProdutoProfissional
  naoLidas?: number
  onAberto?: () => void
  posicao?: number
}

export default function LinhaProfissionalRecomendacaoProduto({
  profissional,
  naoLidas = 0,
  onAberto,
  posicao,
}: Props) {
  const recomendacoesOrdenadas = useMemo(
    () =>
      [...profissional.detalhes].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [profissional.detalhes],
  )

  const total = recomendacoesOrdenadas.length
  const resumo =
    total === 1
      ? '1 produto recomendado'
      : `${total.toLocaleString('pt-BR')} produtos recomendados`

  return (
    <LinhaProfissionalCabecalho
      profissionalId={profissional.profissional_id}
      nome={profissional.profissional_nome}
      username={profissional.profissional_username}
      fotoUrl={profissional.profissional_foto_url}
      verificado={profissional.profissional_verificado}
      naoLidas={naoLidas}
      onAberto={onAberto}
      posicao={posicao}
      resumo={resumo}
    >
      <div className="space-y-3 px-3">
        {recomendacoesOrdenadas.map((detalhe) => {
          const porEmail =
            detalhe.turista_canal === 'email' || Boolean(detalhe.turista_email_prefix)
          const contato = porEmail
            ? formatarEmailTuristaMascarado(detalhe.turista_email_prefix)
            : formatarWhatsappTuristaMascarado(
                detalhe.turista_whatsapp_ddd,
                detalhe.turista_whatsapp_final,
              )

          return (
            <div
              key={detalhe.id}
              className="flex items-start gap-3 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800">
                  {formatarDataCurta(detalhe.created_at)} · {formatarHora(detalhe.created_at)}
                </p>
                {contato ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-600">
                    {porEmail ? (
                      <Mail className="h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
                    ) : (
                      <IconWhatsApp size={16} className="shrink-0 text-[#00D443]" />
                    )}
                    <span className={porEmail ? '' : 'tabular-nums'}>{contato}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-gray-400">Contato do turista não informado</p>
                )}
                {detalhe.produto_nome ? (
                  <p className="mt-1 truncate text-xs font-medium text-gray-500">{detalhe.produto_nome}</p>
                ) : null}
              </div>
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {detalhe.produto_foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detalhe.produto_foto_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </LinhaProfissionalCabecalho>
  )
}
