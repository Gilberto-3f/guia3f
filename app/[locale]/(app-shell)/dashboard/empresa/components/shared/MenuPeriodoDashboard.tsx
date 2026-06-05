'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import type { Periodo } from '../../types/dashboard.types'

const OPCOES: { value: Periodo; label: string }[] = [
  { value: 'hoje', label: 'HOJE' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

interface Props {
  value: Periodo
  onChange: (value: Periodo) => void
}

export default function MenuPeriodoDashboard({ value, onChange }: Props) {
  const [aberto, setAberto] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fechar = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  const labelAtual = OPCOES.find((o) => o.value === value)?.label ?? '30 dias'

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg p-2 text-white/90 transition hover:bg-white/10"
        aria-label={`Filtrar período: ${labelAtual}`}
        aria-expanded={aberto}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>

      {aberto ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {OPCOES.map((op) => (
            <button
              key={op.value}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(op.value)
                setAberto(false)
              }}
              className={`block w-full px-4 py-2.5 text-left text-sm transition ${
                value === op.value
                  ? 'bg-[#0097b2]/10 font-semibold text-[#0097b2]'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
