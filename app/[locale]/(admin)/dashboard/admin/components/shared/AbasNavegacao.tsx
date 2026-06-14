'use client'

import type { LucideIcon } from 'lucide-react'
import { BarChart3, ClipboardCheck, ShieldAlert, Crown, Settings } from 'lucide-react'

export const ABAS_PRINCIPAIS = [
  'visao-geral',
  'cadastros',
  'denuncias',
  'espaco-adm',
  'servicos-tabelados',
  'configuracoes',
] as const
export type AbaPrincipalId = (typeof ABAS_PRINCIPAIS)[number]

const abas: { id: AbaPrincipalId; label: string; Icon: LucideIcon }[] = [
  { id: 'visao-geral', label: 'Ecossistema', Icon: BarChart3 },
  { id: 'cadastros', label: 'Cadastros', Icon: ClipboardCheck },
  { id: 'denuncias', label: 'Denúncias', Icon: ShieldAlert },
  { id: 'espaco-adm', label: 'Espaço ADM', Icon: Crown },
  { id: 'configuracoes', label: 'Configurações', Icon: Settings },
]

const iconActiveClass = 'h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5'
const iconInactiveClass = 'h-5 w-5 shrink-0 text-gray-400 sm:h-5 sm:w-5'

export function AbasNavegacao({
  value,
  onChange,
}: {
  value: AbaPrincipalId
  onChange: (next: AbaPrincipalId) => void
}) {
  return (
    <div className="-mx-1 flex w-full flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {abas.map(({ id, label, Icon }) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            title={label}
            className={[
              'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition',
              active
                ? 'bg-[#0097b2] text-white shadow-sm'
                : 'min-w-[2.5rem] bg-gray-100 text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            {active ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon className={iconActiveClass} strokeWidth={2.25} aria-hidden />
                <span>{label.toUpperCase()}</span>
              </span>
            ) : (
              <Icon className={iconInactiveClass} strokeWidth={2.25} aria-hidden />
            )}
          </button>
        )
      })}
    </div>
  )
}
