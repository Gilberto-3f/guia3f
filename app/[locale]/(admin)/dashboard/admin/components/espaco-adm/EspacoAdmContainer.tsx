'use client'

import { useMemo } from 'react'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { isAdmGeral, podeAcessar } from '../../utils/permissoes'
import { SubabasEspaco, type EspacoSubabaId } from './SubabasEspaco'
import { GraficosAdm } from './graficos-adm/GraficosAdm'
import { EmpresasAdm } from './empresas/EmpresasAdm'
import { FinanceiroAdm } from './financeiro/FinanceiroAdm'
import { GerenciaAdm } from './gerencia/GerenciaAdm'

function coerceSub(sub: string): EspacoSubabaId {
  if (sub === 'empresas' || sub === 'financeiro' || sub === 'gerencia') return sub
  return 'graficos'
}

export function EspacoAdmContainer({ sub }: { sub: string }) {
  const gate = useSharedAdminGate()
  const activeSub = useMemo(() => coerceSub(sub), [sub])

  if (gate.status !== 'ok') return null
  const admin = gate.admin

  const allowed =
    activeSub === 'graficos'
      ? podeAcessar(admin, 'espacoAdm.graficos')
      : activeSub === 'empresas'
        ? podeAcessar(admin, 'espacoAdm.empresas')
        : activeSub === 'financeiro'
          ? podeAcessar(admin, 'espacoAdm.financeiro')
          : isAdmGeral(admin) && podeAcessar(admin, 'espacoAdm.gerencia')

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SubabasEspaco value={activeSub} />
          <div className="text-xs font-semibold text-gray-500">{isAdmGeral(admin) ? 'ADM GERAL' : 'ADMIN'}</div>
        </div>
      </div>

      {!allowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Você não tem permissão para acessar esta subaba.
        </div>
      ) : activeSub === 'graficos' ? (
        <GraficosAdm />
      ) : activeSub === 'empresas' ? (
        <EmpresasAdm />
      ) : activeSub === 'financeiro' ? (
        <FinanceiroAdm />
      ) : (
        <GerenciaAdm />
      )}
    </div>
  )
}

