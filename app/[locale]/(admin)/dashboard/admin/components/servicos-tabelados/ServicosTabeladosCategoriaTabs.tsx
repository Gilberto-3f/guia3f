'use client'

import type { LucideIcon } from 'lucide-react'
import { CATEGORIAS_TABELADOS, type CategoriaTabeladoId } from '@/lib/servicosTabeladosCatalogo'

export function ServicosTabeladosCategoriaTabs({
  value,
  onChange,
}: {
  value: CategoriaTabeladoId
  onChange: (categoria: CategoriaTabeladoId) => void
}) {
  return (
    <div className="flex w-full gap-1" role="tablist" aria-label="Categoria de serviços tabelados">
      {CATEGORIAS_TABELADOS.map(({ id, label, Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(id)}
            className={[
              'flex min-h-[44px] items-center justify-center rounded-lg py-2.5 text-sm font-bold uppercase tracking-wide transition',
              active
                ? 'min-w-0 flex-1 gap-1.5 bg-[#0097b2] px-2 text-white shadow-sm sm:gap-2 sm:px-3'
                : 'w-11 shrink-0 bg-white px-2 text-[#0097b2] hover:bg-gray-50',
            ].join(' ')}
          >
            <Icon
              className={['h-5 w-5 shrink-0', active ? 'text-white' : 'text-[#0097b2]'].join(' ')}
              strokeWidth={2.25}
              aria-hidden
            />
            {active ? <span className="line-clamp-2 text-[11px] leading-tight sm:text-xs">{label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
