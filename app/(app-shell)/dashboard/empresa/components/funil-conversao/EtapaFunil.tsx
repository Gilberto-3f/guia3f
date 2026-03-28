'use client'

import type { ReactNode } from 'react'

interface Props {
  icon: string
  label: string
  valor: number
  offset?: 'left' | 'right'
  children?: ReactNode
  expanded?: boolean
  onToggle?: () => void
}

export default function EtapaFunil({ icon, label, valor, offset, children, expanded, onToggle }: Props) {
  const offsetClass = offset === 'right' ? 'sm:ml-12' : offset === 'left' ? 'sm:mr-12' : ''
  const temDetalhes = Boolean(children)

  return (
    <div className={`relative my-4 ${offsetClass}`}>
      <div className="rounded-lg bg-[#001f3f] p-6 shadow-lg transition-shadow hover:shadow-xl">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-white">
            <span className="text-3xl" aria-hidden>
              {icon}
            </span>
            <span className="font-medium">{label}</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">{valor.toLocaleString()}</p>
        </div>

        {temDetalhes ? (
          <button
            type="button"
            onClick={onToggle}
            className="mt-3 w-full text-center text-sm text-white/70 transition-colors hover:text-white"
          >
            {expanded ? '▲ Ver menos' : '▼ Ver detalhes'}
          </button>
        ) : null}
      </div>

      {expanded && temDetalhes ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">{children}</div>
      ) : null}
    </div>
  )
}

