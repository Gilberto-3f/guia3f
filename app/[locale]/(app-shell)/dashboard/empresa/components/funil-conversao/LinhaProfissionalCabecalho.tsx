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
  onAberto?: () => void
  posicao?: number
  /** Exibir ranking numérico sobre o avatar (padrão: false — avatar limpo). */
  mostrarPosicaoNoAvatar?: boolean
  /** Resumo sempre visível (ex.: quantidade de recomendações, PAX ou vendas). */
  resumo?: string
  children: ReactNode
}

export default function LinhaProfissionalCabecalho({
  profissionalId,
  nome,
  username,
  fotoUrl,
  verificado = false,
  naoLidas = 0,
  onAberto,
  posicao,
  mostrarPosicaoNoAvatar = false,
  resumo,
  children,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const handle = username.replace(/^@+/, '')

  const toggle = () => {
    setAberto((v) => {
      if (!v) onAberto?.()
      return !v
    })
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full flex-col py-3 text-left transition-colors hover:bg-white/60"
        aria-expanded={aberto}
        aria-controls={`detalhe-prof-${profissionalId}`}
      >
        <div className="flex w-full items-start gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
            <AvatarImage src={fotoUrl} alt={nome} width={40} height={40} className="h-full w-full object-cover" />
            {mostrarPosicaoNoAvatar && posicao != null ? (
              <span className="absolute -left-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#0097b2] px-0.5 text-[9px] font-bold tabular-nums text-white">
                {posicao}
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-gray-900">{nome}</p>
            <p className="flex min-w-0 items-center gap-1 truncate text-sm text-gray-500">
              {verificado ? <CheckVerificado /> : null}
              <span className="truncate">@{handle}</span>
            </p>
          </div>
          {!resumo ? (
            <div className="flex shrink-0 flex-col items-center gap-0.5 self-center">
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#0097b2] transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
                aria-hidden
              />
              <CanalNaoLidasBadge count={naoLidas} />
            </div>
          ) : null}
        </div>
        {resumo ? (
          <div className="mt-1.5 flex w-full items-center gap-2">
            <p className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-bold text-gray-700">{resumo}</p>
            <div className="flex shrink-0 items-center gap-0.5">
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#0097b2] transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
                aria-hidden
              />
              <CanalNaoLidasBadge count={naoLidas} />
            </div>
          </div>
        ) : null}
      </button>

      {aberto ? (
        <div id={`detalhe-prof-${profissionalId}`} className="space-y-2 border-t border-gray-100 bg-white/80 py-2 pr-1">
          {children}
        </div>
      ) : null}
    </div>
  )
}
