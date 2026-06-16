'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import CheckVerificado from '@/components/CheckVerificado'
import type { RecomendacaoEmpresaHistorico } from '@/lib/recomendacoesProfissionalHistorico'

type Props = {
  empresa: RecomendacaoEmpresaHistorico
  posicao?: number
  children: ReactNode
}

export default function LinhaEmpresaCabecalho({ empresa, posicao, children }: Props) {
  const [aberto, setAberto] = useState(false)
  const handle = empresa.empresa_username.replace(/^@+/, '')

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-gray-50"
        aria-expanded={aberto}
        aria-controls={`detalhe-emp-${empresa.empresa_id}`}
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <AvatarImage
            src={empresa.empresa_foto_url}
            alt={empresa.empresa_nome}
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
          {posicao != null ? (
            <span className="absolute -left-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#0097b2] px-0.5 text-[9px] font-bold tabular-nums text-white">
              {posicao}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{empresa.empresa_nome}</p>
          <p className="flex min-w-0 items-center gap-1 truncate text-sm text-gray-500">
            {empresa.empresa_verificado ? <CheckVerificado /> : null}
            <span className="truncate">@{handle}</span>
          </p>
          {empresa.total > 0 ? (
            <p className="mt-0.5 text-xs font-semibold text-[#00D443]">
              {empresa.total === 1 ? '1 recomendação' : `${empresa.total} recomendações`}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#0097b2] transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {aberto ? (
        <div id={`detalhe-emp-${empresa.empresa_id}`} className="space-y-2 border-t border-gray-100 bg-gray-50/80 py-2 pr-1">
          {children}
        </div>
      ) : null}
    </div>
  )
}
