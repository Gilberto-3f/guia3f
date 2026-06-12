'use client'

import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Building2, Wallet, Users } from 'lucide-react'
import { useAdminNav } from '../../context/AdminNavContext'

export type EspacoSubabaId = 'graficos' | 'empresas' | 'financeiro' | 'gerencia'

const opts: { id: EspacoSubabaId; label: string; Icon: LucideIcon }[] = [
  { id: 'graficos', label: 'Gráficos ADM', Icon: LayoutDashboard },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
  { id: 'financeiro', label: 'Financeiro', Icon: Wallet },
  { id: 'gerencia', label: 'Gerência', Icon: Users },
]

export function SubabasEspaco({ value }: { value: EspacoSubabaId }) {
  const { selectSub } = useAdminNav()

  const set = (next: EspacoSubabaId) => {
    selectSub('espaco-adm', next)
  }

  return (
    <div className="-mx-1 flex min-w-0 max-w-full flex-nowrap justify-start gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {opts.map((o) => {
        const active = o.id === value
        const Icon = o.Icon
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => set(o.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={o.label}
            title={o.label}
            className={[
              'shrink-0 rounded-xl py-2 text-sm font-semibold transition',
              active
                ? 'inline-flex max-w-[min(100%,18rem)] items-center gap-1.5 bg-emerald-600 px-3 text-white shadow-sm'
                : 'inline-flex min-w-[2.5rem] items-center justify-center bg-white px-2 text-gray-600 shadow-sm ring-1 ring-gray-200/80 hover:bg-gray-50',
            ].join(' ')}
          >
            {active ? (
              <>
                <Icon className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{o.label.toUpperCase()}</span>
              </>
            ) : (
              <Icon className="h-5 w-5 shrink-0 text-gray-400" strokeWidth={2.25} aria-hidden />
            )}
          </button>
        )
      })}
    </div>
  )
}
