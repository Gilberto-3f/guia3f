'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Users, Car, Building2 } from 'lucide-react'

export type VerificacaoSubabaId = 'turistas' | 'profissionais' | 'empresas'

const opts: { id: VerificacaoSubabaId; label: string; Icon: LucideIcon }[] = [
  { id: 'turistas', label: 'Turistas', Icon: Users },
  { id: 'profissionais', label: 'Profissionais', Icon: Car },
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
    <div className="flex w-full gap-1" role="tablist" aria-label="Perfil de cadastros">
      {opts.map((o) => {
        const active = o.id === value
        const Icon = o.Icon
        const count = badges?.[o.id] ?? 0
        const showBadge = typeof badges !== 'undefined' && count > 0

        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={badges ? `${o.label}, ${count} pendente(s)` : o.label}
            title={o.label}
            onClick={() => set(o.id)}
            className={[
              'relative flex min-h-[44px] items-center justify-center rounded-lg py-2.5 text-sm font-bold uppercase tracking-wide transition',
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
            {active ? (
              <span className="whitespace-nowrap">
                {o.label}
                {typeof badges !== 'undefined' ? ` (${count})` : ''}
              </span>
            ) : showBadge ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-none text-white">
                {count > 99 ? '99+' : count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
