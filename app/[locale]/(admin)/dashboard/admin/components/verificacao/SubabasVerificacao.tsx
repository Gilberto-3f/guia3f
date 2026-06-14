'use client'



import type { LucideIcon } from 'lucide-react'

import { Users, Car, Building2, ScrollText } from 'lucide-react'

import type { ContadoresExclusaoCadastro, ContadoresVerificacao } from '../../types/admin.types'

import { useAdminNav } from '../../context/AdminNavContext'

import { CadastroBadgesPar } from './CadastroBadges'

import { TabBadgeAba } from './TabBadgeAba'



export type VerificacaoSubabaId = 'turistas' | 'profissionais' | 'empresas' | 'auditoria'



type PerfilCadastroId = 'turistas' | 'profissionais' | 'empresas'



const perfis: { id: PerfilCadastroId; label: string; Icon: LucideIcon }[] = [

  { id: 'turistas', label: 'Turistas', Icon: Users },

  { id: 'profissionais', label: 'Profissionais', Icon: Car },

  { id: 'empresas', label: 'Empresas', Icon: Building2 },

]



const abaAuditoria = { id: 'auditoria' as const, label: 'Auditoria', Icon: ScrollText }



export function SubabasVerificacao({

  value,

  badges,

  badgesExclusao,

  mostrarBadgeExclusao = false,

}: {

  value: VerificacaoSubabaId

  badges?: ContadoresVerificacao

  badgesExclusao?: ContadoresExclusaoCadastro

  /** Exibe bolinha preta de exclusão (somente ADM GERAL). */

  mostrarBadgeExclusao?: boolean

}) {

  const { selectSub } = useAdminNav()



  const set = (next: VerificacaoSubabaId) => {

    selectSub('cadastros', next)

  }



  return (

    <div className="flex w-full gap-1 pb-2" role="tablist" aria-label="Perfil de cadastros">

      {perfis.map((o) => {

        const active = o.id === value

        const Icon = o.Icon

        const countVerificacao = badges?.[o.id] ?? 0

        const countExclusao = badgesExclusao?.[o.id] ?? 0

        const temBadge = countVerificacao > 0 || (mostrarBadgeExclusao && countExclusao > 0)



        return (

          <button

            key={o.id}

            type="button"

            role="tab"

            aria-selected={active}

            aria-label={

              badges

                ? `${o.label}, ${countVerificacao} verificação(ões) pendente(s)${

                    mostrarBadgeExclusao && countExclusao > 0

                      ? `, ${countExclusao} exclusão(ões) solicitada(s)`

                      : ''

                  }`

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

      {(() => {

        const o = abaAuditoria

        const active = o.id === value

        const Icon = o.Icon

        return (

          <button

            key={o.id}

            type="button"

            role="tab"

            aria-selected={active}

            aria-label={o.label}

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

          </button>

        )

      })()}

    </div>

  )

}


