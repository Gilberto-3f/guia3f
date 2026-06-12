'use client'

import { useMemo } from 'react'
import { SubabasEspaco, type EspacoSubabaId } from './SubabasEspaco'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { isAdmGeral } from '../../utils/permissoes'

function coerceSub(sub: string): EspacoSubabaId {
  if (sub === 'empresas' || sub === 'financeiro' || sub === 'gerencia') return sub
  return 'graficos'
}

export function EspacoAdmBarraFixa({
  sub,
  beneficiosPendentes = 0,
}: {
  sub: string
  beneficiosPendentes?: number
}) {
  const gate = useSharedAdminGate()
  const activeSub = useMemo(() => coerceSub(sub), [sub])

  const meta =
    gate.status === 'ok' ? (
      <span className="hidden text-xs font-semibold text-gray-500 sm:inline">
        {isAdmGeral(gate.admin) ? 'ADM GERAL' : 'ADMIN'}
      </span>
    ) : null

  return (
    <div className="space-y-2.5 border-t border-gray-100 bg-white px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <SubabasEspaco value={activeSub} beneficiosPendentes={beneficiosPendentes} />
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
    </div>
  )
}
