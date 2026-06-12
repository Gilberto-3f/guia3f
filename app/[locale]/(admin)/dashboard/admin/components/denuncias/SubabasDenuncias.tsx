'use client'

import type { LucideIcon } from 'lucide-react'
import { Users, Car, Building2, ScrollText } from 'lucide-react'
import { CadastroBadgesPar } from '../verificacao/CadastroBadges'
import { TabBadgeAba } from '../verificacao/TabBadgeAba'
import type { ContadoresExclusaoCadastro } from '../../types/admin.types'

export type DenunciaSubabaId = 'turistas' | 'profissionais' | 'empresas' | 'auditoria'

const base: { id: DenunciaSubabaId; label: string; Icon: LucideIcon }[] = [
  { id: 'turistas', label: 'Turistas', Icon: Users },
  { id: 'profissionais', label: 'Profissionais', Icon: Car },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
  { id: 'auditoria', label: 'Auditoria', Icon: ScrollText },
]

export default function SubabasDenuncias({
  perfilAtivo,
  onPerfilChange,
  podeVerProfissionais,
  podeVerEmpresas,
  badgesPendentes,
  badgesExclusao,
  mostrarBadgeExclusao = false,
}: {
  perfilAtivo: DenunciaSubabaId
  onPerfilChange: (p: DenunciaSubabaId) => void
  podeVerProfissionais: boolean
  podeVerEmpresas: boolean
  badgesPendentes?: Partial<Record<DenunciaSubabaId, number>>
  badgesExclusao?: ContadoresExclusaoCadastro
  mostrarBadgeExclusao?: boolean
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
        const countVerificacao =
          o.id === 'auditoria' ? 0 : typeof badgesPendentes?.[o.id] === 'number' ? badgesPendentes[o.id]! : 0
        const countExclusao =
          o.id === 'turistas' || o.id === 'profissionais' || o.id === 'empresas'
            ? badgesExclusao?.[o.id] ?? 0
            : 0
        const temBadge =
          o.id !== 'auditoria' &&
          (countVerificacao > 0 || (mostrarBadgeExclusao && countExclusao > 0))

        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPerfilChange(o.id)}
            aria-label={
              o.id === 'auditoria'
                ? o.label
                : `${o.label}, ${countVerificacao} pendente(s)${
                    mostrarBadgeExclusao && countExclusao > 0 ? `, ${countExclusao} exclusão(ões)` : ''
                  }`
            }
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
            {temBadge ? (
              <TabBadgeAba>
                <CadastroBadgesPar
                  verificacoes={countVerificacao}
                  exclusoes={countExclusao}
                  mostrarExclusao={mostrarBadgeExclusao}
                />
              </TabBadgeAba>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
