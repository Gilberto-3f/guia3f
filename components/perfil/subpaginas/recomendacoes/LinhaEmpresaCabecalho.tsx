'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import CheckVerificado from '@/components/CheckVerificado'
import type { RecomendacaoEmpresaHistorico } from '@/lib/recomendacoesProfissionalHistorico'

type Props = {
  empresa: RecomendacaoEmpresaHistorico
  children: ReactNode
}

export default function LinhaEmpresaCabecalho({ empresa, children }: Props) {
  const [aberto, setAberto] = useState(false)
  const handle = empresa.empresa_username.replace(/^@+/, '')

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50"
        aria-expanded={aberto}
        aria-controls={`detalhe-emp-${empresa.empresa_id}`}
      >
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <AvatarImage
            src={empresa.empresa_foto_url}
            alt={empresa.empresa_nome}
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-end gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-snug text-gray-900">{empresa.empresa_nome}</p>
            <p className="flex min-w-0 items-center gap-1 truncate text-sm leading-snug text-gray-500">
              {empresa.empresa_verificado ? <CheckVerificado /> : null}
              <span className="truncate">@{handle}</span>
            </p>
            {empresa.total > 0 ? (
              <p className="mt-0.5 text-xs font-semibold leading-snug text-[#00D443]">
                {empresa.total === 1 ? '1 recomendação' : `${empresa.total} recomendações`}
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={`mb-0.5 h-4 w-4 shrink-0 text-[#0097b2] transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>
      </button>

      {aberto ? (
        <div id={`detalhe-emp-${empresa.empresa_id}`} className="space-y-2 border-t border-gray-100 bg-gray-50/80 py-2 pr-1">
          {children}
        </div>
      ) : null}
    </div>
  )
}
