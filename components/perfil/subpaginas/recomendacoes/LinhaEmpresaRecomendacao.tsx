'use client'

import { useMemo } from 'react'
import { Mail } from 'lucide-react'
import IconWhatsApp from '@/components/IconWhatsApp'
import {
  formatarEmailTuristaMascarado,
  formatarWhatsappTuristaMascarado,
} from '@/lib/recomendarEmpresa'
import type { RecomendacaoEmpresaHistorico } from '@/lib/recomendacoesProfissionalHistorico'
import {
  formatarDataCurta,
  formatarHora,
} from '@/app/[locale]/(app-shell)/dashboard/empresa/components/funil-conversao/formatarDataHora'
import LinhaEmpresaCabecalho from './LinhaEmpresaCabecalho'

type Props = {
  empresa: RecomendacaoEmpresaHistorico
}

export default function LinhaEmpresaRecomendacao({ empresa }: Props) {
  const recomendacoesOrdenadas = useMemo(
    () =>
      [...empresa.detalhes].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [empresa.detalhes],
  )

  return (
    <LinhaEmpresaCabecalho empresa={empresa}>
      <div className="space-y-3 px-3">
        <p className="text-sm font-bold text-gray-700">
          {recomendacoesOrdenadas.length === 1
            ? '1 recomendação feita'
            : `${recomendacoesOrdenadas.length} recomendações feitas`}
        </p>
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
              className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
            >
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
            </div>
          )
        })}
      </div>
    </LinhaEmpresaCabecalho>
  )
}
