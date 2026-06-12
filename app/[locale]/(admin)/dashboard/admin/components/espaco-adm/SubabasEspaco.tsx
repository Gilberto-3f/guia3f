'use client'

import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Building2, Wallet, Users } from 'lucide-react'
import { useAdminNav } from '../../context/AdminNavContext'
import { CadastroVerificacaoBadge } from '../verificacao/CadastroBadges'
import { TabBadgeAba } from '../verificacao/TabBadgeAba'

export type EspacoSubabaId = 'graficos' | 'empresas' | 'financeiro' | 'gerencia'

const opts: { id: EspacoSubabaId; label: string; Icon: LucideIcon }[] = [
  { id: 'graficos', label: 'Gráficos ADM', Icon: LayoutDashboard },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
  { id: 'financeiro', label: 'Financeiro', Icon: Wallet },
  { id: 'gerencia', label: 'Gerência', Icon: Users },
]

export function SubabasEspaco({
  value,
  beneficiosPendentes = 0,
}: {
  value: EspacoSubabaId
  beneficiosPendentes?: number
}) {
  const { selectSub } = useAdminNav()

  const set = (next: EspacoSubabaId) => {
    selectSub('espaco-adm', next)
  }

  return (
    <div className="flex w-full gap-1" role="tablist" aria-label="Seções do Espaço ADM">
      {opts.map((o) => {
        const active = o.id === value
        const Icon = o.Icon
        const temBadge = o.id === 'empresas' && beneficiosPendentes > 0

        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={
              temBadge
                ? `${o.label}, ${beneficiosPendentes} análise(s) de benefícios pendente(s)`
                : o.label
            }
            title={o.label}
            onClick={() => set(o.id)}
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
            {temBadge ? (
              <TabBadgeAba>
                <CadastroVerificacaoBadge count={beneficiosPendentes} />
              </TabBadgeAba>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
