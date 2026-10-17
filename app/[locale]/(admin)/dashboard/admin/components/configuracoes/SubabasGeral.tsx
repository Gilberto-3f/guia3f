'use client'

import type { LucideIcon } from 'lucide-react'
import { Globe, Building2 } from 'lucide-react'
import { useAdminNav } from '../../context/AdminNavContext'
import type { ConfigGeralSubId } from './ConfiguracoesTabs'
import { configSubGeral } from './ConfiguracoesTabs'

const opts: { id: ConfigGeralSubId; label: string; Icon: LucideIcon }[] = [
  { id: 'ecossistema', label: 'Ecossistema', Icon: Globe },
  { id: 'organizacao', label: 'Organização', Icon: Building2 },
]

export function SubabasGeral({ value }: { value: ConfigGeralSubId }) {
  const { selectSub } = useAdminNav()

  return (
    <div className="flex w-full gap-1" role="tablist" aria-label="Geral">
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
            onClick={() => selectSub('configuracoes', configSubGeral(id))}
            className={[
              'flex min-h-[40px] items-center justify-center rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition sm:text-sm',
              active
                ? 'min-w-0 flex-1 gap-1.5 bg-[#00D443] px-3 text-white shadow-sm'
                : 'w-10 shrink-0 bg-gray-100 px-2 text-[#00D443] hover:bg-gray-200',
            ].join(' ')}
          >
            <Icon
              className={['h-4 w-4 shrink-0 sm:h-5 sm:w-5', active ? 'text-white' : 'text-[#00D443]'].join(' ')}
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
