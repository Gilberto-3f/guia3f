'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

const CLASSE_ICONE =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#0097b2] text-white'

interface Props {
  id: string
  titulo: string
  icon: LucideIcon
  children: ReactNode
  aberto?: boolean
  onToggle?: () => void
  controlado?: boolean
}

export default function PastaRelatorioLista({
  id,
  titulo,
  icon: Icon,
  children,
  aberto: abertoProp,
  onToggle,
  controlado = false,
}: Props) {
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = controlado ? Boolean(abertoProp) : abertoLocal

  const toggle = () => {
    if (controlado) {
      onToggle?.()
    } else {
      setAbertoLocal((v) => !v)
    }
  }

  return (
    <div>
      <button
        type="button"
        id={`pasta-${id}`}
        onClick={toggle}
        className="flex w-full items-center gap-3 text-left transition-colors hover:bg-gray-50/60"
        aria-expanded={aberto}
      >
        <div className={CLASSE_ICONE}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 border-b border-gray-200/80 py-3">
          <span className="min-w-0 text-[15px] font-normal text-gray-900">{titulo}</span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>
      </button>

      {aberto ? <div className="pb-2 pl-[52px] pt-1">{children}</div> : null}
    </div>
  )
}
