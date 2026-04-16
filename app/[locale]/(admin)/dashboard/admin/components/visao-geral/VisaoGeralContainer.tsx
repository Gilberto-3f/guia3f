'use client'

import { useMemo, useState } from 'react'
import { FiltrosPeriodo, type PeriodoId } from '../shared/FiltrosPeriodo'
import type { VisaoSubabaId } from './SubabasVisaoNav'
import { VisaoGeralGraficos } from './VisaoGeralGraficos'

function coerceSub(sub: string): VisaoSubabaId {
  if (sub === 'profissionais' || sub === 'empresas') return sub
  return 'turistas'
}

export function VisaoGeralContainer({ sub }: { sub: string }) {
  const activeSub = useMemo(() => coerceSub(sub), [sub])
  const [periodo, setPeriodo] = useState<PeriodoId>('7d')
  const filtrosVisao = useMemo(() => ({ periodo }), [periodo])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 shadow-sm sm:p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Período dos gráficos</p>
        <FiltrosPeriodo value={periodo} onChange={setPeriodo} />
      </div>

      <VisaoGeralGraficos value={activeSub} filtros={filtrosVisao} />
    </div>
  )
}
