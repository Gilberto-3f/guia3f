'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'
import CheckVerificado from '@/components/CheckVerificado'

interface Props {
  profissionalId: string
  nome: string
  username: string
  fotoUrl: string | null
  verificado?: boolean
  naoLidas?: number
  children: ReactNode
}

export default function LinhaProfissionalCabecalho({
  profissionalId,
  nome,
  username,
  fotoUrl,
  verificado = false,
  naoLidas = 0,
  children,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const handle = username.replace(/^@+/, '')

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/60"
        aria-expanded={aberto}
        aria-controls={`detalhe-prof-${profissionalId}`}
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <AvatarImage src={fotoUrl} alt={nome} width={40} height={40} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{nome}</p>
          <p className="flex min-w-0 items-center gap-1 truncate text-sm text-gray-500">
            {verificado ? <CheckVerificado /> : null}
            <span className="truncate">@{handle}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <CanalNaoLidasBadge count={naoLidas} />
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[#0097b2] transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>
      </button>

      {aberto ? (
        <div id={`detalhe-prof-${profissionalId}`} className="space-y-2 border-t border-gray-100 bg-white/80 py-2 pr-1">
          {children}
        </div>
      ) : null}
    </div>
  )
}
