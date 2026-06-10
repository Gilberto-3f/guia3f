'use client'

import type { ReactNode } from 'react'
import { Users, Briefcase, Building2 } from 'lucide-react'
import type { FiltrosVisaoGeral, PerfilVisaoGeral } from '../../types/admin.types'
import { useAdminData } from '../../hooks/useAdminData'

const FILTROS_TOPO_CARDS: FiltrosVisaoGeral = { periodo: '30d' }

const PERFIS: { id: PerfilVisaoGeral; label: string; icon: typeof Users }[] = [
  { id: 'turistas', label: 'Turistas', icon: Users },
  { id: 'profissionais', label: 'Profissionais', icon: Briefcase },
  { id: 'empresas', label: 'Empresas', icon: Building2 },
]

function Card({
  icon,
  label,
  valor = '-',
  deltaPct,
  loading,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  valor?: string
  deltaPct?: number
  loading?: boolean
  active: boolean
  onClick: () => void
}) {
  const up = (deltaPct ?? 0) >= 0
  const trendLabel = `${up ? '↑' : '↓'} ${Math.abs(deltaPct ?? 0).toFixed(1)}%`

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex min-h-0 min-w-0 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0097b2]/40"
    >
      <div
        className={[
          'flex aspect-square h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border p-1.5 text-center shadow-sm transition-colors sm:gap-1 sm:p-2.5 lg:p-3',
          active
            ? 'border-[#0097b2] bg-[#0097b2] text-white'
            : 'border-[#0097b2]/25 bg-white hover:border-[#0097b2]/50',
        ].join(' ')}
      >
        <div className="flex shrink-0 items-center justify-center" aria-hidden>
          {icon}
        </div>
        <span
          className={[
            'max-w-full truncate text-[0.6rem] font-semibold uppercase tracking-wide sm:text-xs',
            active ? 'text-white' : 'text-[#0097b2]',
          ].join(' ')}
        >
          {label}
        </span>
        <span
          className={[
            'max-w-full truncate text-base font-bold tabular-nums sm:text-xl lg:text-2xl',
            active ? 'text-white' : 'text-gray-900',
          ].join(' ')}
        >
          {loading ? '…' : valor}
        </span>
        {!loading && typeof deltaPct === 'number' ? (
          <span
            className={[
              'text-[0.65rem] font-semibold sm:text-xs',
              active ? 'text-white/90' : up ? 'text-emerald-700' : 'text-rose-700',
            ].join(' ')}
          >
            {trendLabel}
          </span>
        ) : null}
      </div>
    </button>
  )
}

function useTopoCardsDados() {
  const { topoCards, loading } = useAdminData('turistas', FILTROS_TOPO_CARDS, { loadTopoCards: true })
  return {
    loading,
    dados: {
      turistas: topoCards?.turistas,
      profissionais: topoCards?.profissionais,
      empresas: topoCards?.empresas,
    },
  }
}

/** Resumo fixo no painel principal (sem navegação). */
export function TopoCardsResumo() {
  const { loading, dados } = useTopoCardsDados()

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
      {PERFIS.map(({ id, label, icon: Icon }) => {
        const resumo = dados[id]
        const iconClass = 'h-[1.125rem] w-[1.125rem] shrink-0 text-[#0097b2] sm:h-6 sm:w-6'

        return (
          <div
            key={id}
            className="flex aspect-square min-h-0 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-[#0097b2]/25 bg-white p-1.5 text-center shadow-sm sm:gap-1 sm:p-2.5 lg:p-3"
          >
            <Icon className={iconClass} strokeWidth={2} aria-hidden />
            <span className="max-w-full truncate text-[0.6rem] font-semibold uppercase tracking-wide text-[#0097b2] sm:text-xs">
              {label}
            </span>
            <span className="max-w-full truncate text-base font-bold tabular-nums text-gray-900 sm:text-xl lg:text-2xl">
              {loading ? '…' : resumo ? resumo.total.toLocaleString('pt-BR') : '-'}
            </span>
            {!loading && typeof resumo?.variacao === 'number' ? (
              <span
                className={[
                  'text-[0.65rem] font-semibold sm:text-xs',
                  resumo.variacao >= 0 ? 'text-emerald-700' : 'text-rose-700',
                ].join(' ')}
              >
                {resumo.variacao >= 0 ? '↑' : '↓'} {Math.abs(resumo.variacao).toFixed(1)}%
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function TopoCards({
  active,
  onSelect,
}: {
  active: PerfilVisaoGeral
  onSelect: (perfil: PerfilVisaoGeral) => void
}) {
  const { loading, dados } = useTopoCardsDados()

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
      {PERFIS.map(({ id, label, icon: Icon }) => {
        const resumo = dados[id]
        const iconClass = [
          'h-[1.125rem] w-[1.125rem] shrink-0 sm:h-6 sm:w-6',
          active === id ? 'text-white' : 'text-[#0097b2]',
        ].join(' ')

        return (
          <Card
            key={id}
            active={active === id}
            onClick={() => onSelect(id)}
            icon={<Icon className={iconClass} strokeWidth={2} />}
            label={label}
            valor={resumo ? resumo.total.toLocaleString('pt-BR') : '-'}
            deltaPct={resumo?.variacao}
            loading={loading}
          />
        )
      })}
    </div>
  )
}
