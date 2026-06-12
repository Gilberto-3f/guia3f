'use client'

import type { LucideIcon } from 'lucide-react'
import { Users, Car, Building2, ScrollText } from 'lucide-react'
import { TabBadgeAba } from '../verificacao/TabBadgeAba'

export type DenunciaSubabaId = 'turistas' | 'profissionais' | 'empresas' | 'auditoria'

const base: { id: DenunciaSubabaId; label: string; Icon: LucideIcon }[] = [
  { id: 'turistas', label: 'Turistas', Icon: Users },
  { id: 'profissionais', label: 'Profissionais', Icon: Car },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
  { id: 'auditoria', label: 'Auditoria', Icon: ScrollText },
]

function BadgeDenuncia({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

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
    <div className="flex w-full gap-1 pb-2" role="tablist" aria-label="Perfil de denúncias">
      {visible.map((o) => {
        const active = o.id === perfilAtivo
        const Icon = o.Icon
        const count = typeof badges?.[o.id] === 'number' ? badges[o.id]! : 0
        const showBadge = typeof badges?.[o.id] === 'number' && count > 0

        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPerfilChange(o.id)}
            aria-label={typeof badges?.[o.id] === 'number' ? `${o.label}, ${count}` : o.label}
            title={o.label}
            className={[
              'relative flex min-h-[44px] items-center justify-center overflow-visible rounded-lg py-2.5 text-sm font-bold uppercase tracking-wide transition',
              active
                ? 'min-w-0 flex-1 gap-1.5 bg-[#0097b2] px-3 text-white shadow-sm'
                : 'w-11 shrink-0 bg-white px-2 text-[#0097b2] hover:bg-gray-50',
            ].join(' ')}
          >
            <Icon
              className={['h-5 w-5 shrink-0', active ? 'text-white' : 'text-[#0097b2]'].join(' ')}
              strokeWidth={2.25}
              aria-hidden
            />
            {active ? <span className="whitespace-nowrap">{o.label}</span> : null}
            {showBadge ? (
              <TabBadgeAba>
                <BadgeDenuncia count={count} />
              </TabBadgeAba>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
