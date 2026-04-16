'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Users, Briefcase, Building2 } from 'lucide-react'

export type VerificacaoSubabaId = 'turistas' | 'profissionais' | 'empresas'

const opts: { id: VerificacaoSubabaId; label: string; Icon: LucideIcon }[] = [
  { id: 'turistas', label: 'Turistas', Icon: Users },
  { id: 'profissionais', label: 'Profissionais', Icon: Briefcase },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
]

export function SubabasVerificacao({
  value,
  badges,
}: {
  value: VerificacaoSubabaId
  badges?: Record<VerificacaoSubabaId, number>
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const set = (next: VerificacaoSubabaId) => {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', 'cadastros')
    params.set('sub', next)
    router.replace(`?${params.toString()}`)
  }

  return (
    <div className="-mx-1 flex min-w-0 max-w-full flex-nowrap justify-start gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {opts.map((o) => {
        const active = o.id === value
        const Icon = o.Icon
        const count = badges?.[o.id] ?? 0
        const showBadge = typeof badges !== 'undefined' && count > 0

        return (
          <button
            key={o.id}
            type="button"
            onClick={() => set(o.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={badges ? `${o.label}, ${count} pendente(s)` : o.label}
            title={o.label}
            className={[
              'relative shrink-0 rounded-xl py-2 text-sm font-semibold transition',
              active
                ? 'inline-flex items-center gap-1.5 bg-emerald-600 px-3 text-white shadow-sm'
                : 'inline-flex min-w-[2.5rem] items-center justify-center bg-gray-100 px-2 text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            {active ? (
              <>
                <Icon className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
                <span className="whitespace-nowrap">
                  {o.label.toUpperCase()}
                  {typeof badges !== 'undefined' ? ` (${count})` : ''}
                </span>
              </>
            ) : (
              <>
                <Icon className="h-5 w-5 shrink-0 text-gray-400" strokeWidth={2.25} aria-hidden />
                {showBadge ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-none text-white">
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
