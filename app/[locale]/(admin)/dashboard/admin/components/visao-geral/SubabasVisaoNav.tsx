'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Users, Briefcase, Building2 } from 'lucide-react'
import { adminHref } from '../../utils/adminUrl'

export type VisaoSubabaId = 'turistas' | 'profissionais' | 'empresas'

const opts: { id: VisaoSubabaId; label: string; Icon: LucideIcon }[] = [
  { id: 'turistas', label: 'Turistas', Icon: Users },
  { id: 'profissionais', label: 'Profissionais', Icon: Briefcase },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
]

export function SubabasVisaoNav({ value }: { value: VisaoSubabaId }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const set = (next: VisaoSubabaId) => {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', 'visao-geral')
    params.set('sub', next)
    router.replace(adminHref(pathname, params), { scroll: false })
  }

  return (
    <div className="-mx-1 flex min-w-0 max-w-full flex-nowrap justify-start gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:thin]">
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
                ? 'inline-flex items-center gap-1.5 bg-emerald-600 px-3 text-white shadow-sm'
                : 'inline-flex min-w-[2.5rem] items-center justify-center bg-white px-2 text-gray-600 shadow-sm ring-1 ring-gray-200/80 hover:bg-gray-50',
            ].join(' ')}
          >
            {active ? (
              <>
                <Icon className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
                <span className="whitespace-nowrap">{o.label.toUpperCase()}</span>
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
