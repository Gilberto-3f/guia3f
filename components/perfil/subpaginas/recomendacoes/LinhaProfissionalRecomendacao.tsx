'use client'

import { useMemo } from 'react'
import { CheckCircle2, Mail } from 'lucide-react'
import IconWhatsApp from '@/components/IconWhatsApp'
import AvatarImage from '@/components/AvatarImage'
import {
  contatoMascaradoRecomendacao,
  type RecomendacaoProfissionalHistorico,
} from '@/lib/recomendacoesProfParceriasHistorico'
import {
  formatarDataCurta,
  formatarHora,
} from '@/app/[locale]/(app-shell)/dashboard/empresa/components/funil-conversao/formatarDataHora'

type Props = {
  profissional: RecomendacaoProfissionalHistorico
}

export default function LinhaProfissionalRecomendacao({ profissional }: Props) {
  const detalhes = useMemo(
    () =>
      [...profissional.detalhes].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [profissional.detalhes],
  )

  const handle = profissional.profissional_username.replace(/^@+/, '')

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-3 px-3 py-3">
        <AvatarImage
          src={profissional.profissional_foto_url}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{profissional.profissional_nome}</p>
          <p className="truncate text-sm text-[#0097b2]">@{handle}</p>
          <p className="text-xs text-gray-500">{profissional.profissional_categorias}</p>
          <p className="mt-0.5 text-xs font-semibold text-[#00D443]">
            {profissional.total} {profissional.total === 1 ? 'indicação' : 'indicações'}
            {profissional.contratacoes > 0
              ? ` · ${profissional.contratacoes} contratada${profissional.contratacoes === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-gray-100 bg-gray-50/80 px-3 py-2">
        {detalhes.map((d) => {
          const contato = contatoMascaradoRecomendacao(d)
          const porEmail = d.turista_canal === 'email' || Boolean(d.turista_email_prefix)
          return (
            <div key={d.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
              <p className="text-sm text-gray-800">
                {formatarDataCurta(d.created_at)} · {formatarHora(d.created_at)}
              </p>
              {contato ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-600">
                  {porEmail ? (
                    <Mail className="h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
                  ) : (
                    <IconWhatsApp size={16} className="shrink-0 text-[#00D443]" />
                  )}
                  <span>{contato}</span>
                </p>
              ) : null}
              {d.contratado_em ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#15803d]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Turista contratou em {formatarDataCurta(d.contratado_em)} · {formatarHora(d.contratado_em)}
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">Aguardando contratação do turista</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
