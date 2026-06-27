'use client'

import type { LucideIcon } from 'lucide-react'
import { Smartphone, Shield } from 'lucide-react'
import { useAdminNav } from '../../context/AdminNavContext'
import type { ConfigConformidadeSubId } from './ConfiguracoesTabs'
import { configSubConformidade } from './ConfiguracoesTabs'

const opts: { id: ConfigConformidadeSubId; label: string; Icon: LucideIcon }[] = [
  { id: 'aplicativo', label: 'Aplicativo', Icon: Smartphone },
  { id: 'seguranca', label: 'Segurança', Icon: Shield },
]

export function SubabasConformidade({ value }: { value: ConfigConformidadeSubId }) {
  const { selectSub } = useAdminNav()

  return (
    <div className="flex w-full gap-1" role="tablist" aria-label="Conformidade">
      {opts.map(({ id, label, Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            title={label}
            onClick={() => selectSub('configuracoes', configSubConformidade(id))}
            className={[
              'flex min-h-[40px] items-center justify-center rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition sm:text-sm',
              active
                ? 'min-w-0 flex-1 gap-1.5 bg-[#001f3f] px-3 text-white shadow-sm'
                : 'w-10 shrink-0 bg-gray-100 px-2 text-[#001f3f] hover:bg-gray-200',
            ].join(' ')}
          >
            <Icon
              className={['h-4 w-4 shrink-0 sm:h-5 sm:w-5', active ? 'text-white' : 'text-[#001f3f]'].join(' ')}
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
