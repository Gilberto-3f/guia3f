'use client'

import { useMemo, useState } from 'react'
import { FiltrosPeriodo, type PeriodoId } from '../shared/FiltrosPeriodo'
import { SubabasVisao, type VisaoSubabaId } from './SubabasVisao'

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
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <SubabasVisao value={activeSub} filtros={filtrosVisao} />
        <FiltrosPeriodo value={periodo} onChange={setPeriodo} />
      </div>
    </div>
  )
}

