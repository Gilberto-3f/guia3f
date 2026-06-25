'use client'

import type { LucideIcon } from 'lucide-react'
import { Plug, Settings, Lock } from 'lucide-react'

export type ConfigSubabaId = 'apis' | 'geral' | 'seguranca'

const TABS: { id: ConfigSubabaId; label: string; Icon: LucideIcon }[] = [
  { id: 'apis', label: 'AP', Icon: Plug },
  { id: 'geral', label: 'Geral', Icon: Settings },
  { id: 'seguranca', label: 'Segurança', Icon: Lock },
]

export function ConfiguracoesTabs({
  value,
  onChange,
}: {
  value: ConfigSubabaId
  onChange: (next: ConfigSubabaId) => void
}) {
  return (
    <div className="flex w-full gap-1" role="tablist" aria-label="Configurações">
      {TABS.map(({ id, label, Icon }) => {
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
                ? 'min-w-0 flex-1 gap-2 bg-[#0097b2] px-3 text-white shadow-sm'
                : 'w-11 shrink-0 bg-white px-2 text-[#0097b2] hover:bg-gray-50',
            ].join(' ')}
          >
            <Icon
              className={['h-5 w-5 shrink-0', active ? 'text-white' : 'text-[#0097b2]'].join(' ')}
              strokeWidth={2.25}
              aria-hidden
            />
            {active ? <span className="whitespace-nowrap">{label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function coerceConfigSubaba(sub: string): ConfigSubabaId {
  if (sub === 'geral' || sub === 'seguranca') return sub
  if (sub === 'logs') return 'geral'
  return 'apis'
}
