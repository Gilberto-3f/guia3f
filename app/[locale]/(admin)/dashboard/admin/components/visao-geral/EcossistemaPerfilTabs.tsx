'use client'

import type { LucideIcon } from 'lucide-react'
import { Users, Briefcase, Building2 } from 'lucide-react'
import type { PerfilVisaoGeral } from '../../types/admin.types'

const PERFIS: { id: PerfilVisaoGeral; label: string; Icon: LucideIcon }[] = [
  { id: 'turistas', label: 'Turistas', Icon: Users },
  { id: 'profissionais', label: 'Profissionais', Icon: Briefcase },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
]

export function EcossistemaPerfilTabs({
  value,
  onChange,
}: {
  value: PerfilVisaoGeral
  onChange: (perfil: PerfilVisaoGeral) => void
}) {
  return (
    <div className="grid w-full grid-cols-3 gap-1" role="tablist" aria-label="Perfil do ecossistema">
      {PERFIS.map(({ id, label, Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            onClick={() => onChange(id)}
            className={[
              'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-bold uppercase tracking-wide transition',
              active ? 'bg-[#0097b2] text-white shadow-sm' : 'bg-white text-[#0097b2] hover:bg-gray-50',
            ].join(' ')}
          >
            <Icon
              className={['h-5 w-5 shrink-0', active ? 'text-white' : 'text-[#0097b2]'].join(' ')}
              strokeWidth={2.25}
              aria-hidden
            />
            {active ? <span className="truncate">{label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
