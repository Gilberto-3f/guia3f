'use client'

import { ChevronDown, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const COR_LOGO = '#0097b2'

export function AdminSecaoChevron({
  titulo,
  aberta,
  onToggle,
  badge,
  tituloGrande = false,
  icone: Icone,
  corTitulo,
  descricao,
  children,
}: {
  titulo: string
  aberta: boolean
  onToggle: () => void
  badge?: number
  /** Títulos maiores (ex.: gráficos da Visão Geral). */
  tituloGrande?: boolean
  /** Ícone à esquerda do título (sem fundo). */
  icone?: LucideIcon
  /** Cor do título e do ícone (padrão cinza escuro). */
  corTitulo?: string
  /** Texto curto exibido acima do conteúdo ao expandir. */
  descricao?: string
  children: ReactNode
}) {
  const cor = corTitulo ?? undefined
  const tituloCls = [
    tituloGrande ? 'text-base font-bold sm:text-lg' : 'text-sm font-bold',
    cor ? '' : 'text-gray-900',
  ].join(' ')

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 px-4 text-left hover:bg-gray-50 ${tituloGrande ? 'py-4' : 'py-3.5'}`}
        aria-expanded={aberta}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {Icone ? (
            <Icone
              className="h-5 w-5 shrink-0"
              style={{ color: cor ?? COR_LOGO }}
              strokeWidth={2.25}
              aria-hidden
            />
          ) : null}
          <span className={tituloCls} style={cor ? { color: cor } : undefined}>
            {titulo}
          </span>
          {badge != null && badge > 0 ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-600 transition-transform ${aberta ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {aberta ? (
        <div className="space-y-3 border-t border-gray-100 px-4 py-3">
          {descricao ? (
            <p className="text-center text-xs text-gray-500 sm:text-sm">{descricao}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}
