'use client'

import type { FiltrosVisaoGeral } from '../../types/admin.types'
import { useAdminData } from '../../hooks/useAdminData'

/** Referência estável: evita novo objeto a cada render e re-disparos desnecessários no hook. */
const FILTROS_TOPO_CARDS: FiltrosVisaoGeral = { periodo: '30d' }

function Card({
  icon,
  label,
  valor = '-',
  deltaPct,
  loading,
}: {
  icon: string
  label: string
  valor?: string
  deltaPct?: number
  loading?: boolean
}) {
  const up = (deltaPct ?? 0) >= 0
  const trendLabel = `${up ? '↑' : '↓'} ${Math.abs(deltaPct ?? 0).toFixed(1)}%`

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div
        className={[
          'flex aspect-square h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-[#0097b2]/35 bg-white p-1.5 text-center shadow-sm sm:gap-1 sm:p-2.5 lg:p-3',
        ].join(' ')}
      >
        <span className="text-lg leading-none sm:text-2xl" aria-hidden>
          {icon}
        </span>
        <span className="max-w-full truncate text-[0.6rem] font-semibold uppercase tracking-wide text-[#0097b2] sm:text-xs">
          {label}
        </span>
        <span className="max-w-full truncate text-base font-bold tabular-nums text-gray-900 sm:text-xl lg:text-2xl">
          {loading ? '…' : valor}
        </span>
        {!loading && typeof deltaPct === 'number' ? (
          <span className={`text-[0.65rem] font-semibold sm:text-xs ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
            {trendLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function TopoCards() {
  const { topoCards, loading } = useAdminData('turistas', FILTROS_TOPO_CARDS, { loadTopoCards: true })

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
      <Card
        icon="👥"
        label="Turistas"
        valor={topoCards ? topoCards.turistas.total.toLocaleString('pt-BR') : '-'}
        deltaPct={topoCards?.turistas.variacao}
        loading={loading}
      />
      <Card
        icon="🚗"
        label="Profissionais"
        valor={topoCards ? topoCards.profissionais.total.toLocaleString('pt-BR') : '-'}
        deltaPct={topoCards?.profissionais.variacao}
        loading={loading}
      />
      <Card
        icon="🏢"
        label="Empresas"
        valor={topoCards ? topoCards.empresas.total.toLocaleString('pt-BR') : '-'}
        deltaPct={topoCards?.empresas.variacao}
        loading={loading}
      />
    </div>
  )
}
