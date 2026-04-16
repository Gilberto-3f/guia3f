'use client'

import type { LucideIcon } from 'lucide-react'
import { Users, Briefcase, Building2 } from 'lucide-react'

export type DenunciaSubabaId = 'turistas' | 'profissionais' | 'empresas'

const base: { id: DenunciaSubabaId; label: string; Icon: LucideIcon }[] = [
  { id: 'turistas', label: 'Turistas', Icon: Users },
  { id: 'profissionais', label: 'Profissionais', Icon: Briefcase },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
]

export default function SubabasDenuncias({
  perfilAtivo,
  onPerfilChange,
  podeVerProfissionais,
  podeVerEmpresas,
  badges,
}: {
  perfilAtivo: DenunciaSubabaId
  onPerfilChange: (p: DenunciaSubabaId) => void
  podeVerProfissionais: boolean
  podeVerEmpresas: boolean
  badges?: Partial<Record<DenunciaSubabaId, number>>
}) {
  const visible = base.filter((o) => {
    if (o.id === 'profissionais' && !podeVerProfissionais) return false
    if (o.id === 'empresas' && !podeVerEmpresas) return false
    return true
  })

  return (
    <div className="-mx-1 flex min-w-0 max-w-full flex-nowrap justify-start gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {visible.map((o) => {
        const active = o.id === perfilAtivo
        const Icon = o.Icon
        const count = typeof badges?.[o.id] === 'number' ? badges[o.id]! : 0
        const showBadge = typeof badges?.[o.id] === 'number' && count > 0

        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPerfilChange(o.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={typeof badges?.[o.id] === 'number' ? `${o.label}, ${count}` : o.label}
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
                  {typeof badges?.[o.id] === 'number' ? ` (${count})` : ''}
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
