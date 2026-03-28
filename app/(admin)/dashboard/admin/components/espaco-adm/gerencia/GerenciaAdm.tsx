'use client'

import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'
import { ConvidarAdmin } from './ConvidarAdmin'
import { ListaAdmins } from './ListaAdmins'
import { PagamentosColaboradores } from './PagamentosColaboradores'
import { GestaoAdvertencias } from './GestaoAdvertencias'

export function GerenciaAdm() {
  const { isAdminGeral } = useGerenciaAdm()

  if (!isAdminGeral) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Apenas ADM GERAL pode acessar esta área.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ConvidarAdmin />
      <ListaAdmins />
      <PagamentosColaboradores />
      <GestaoAdvertencias />
    </div>
  )
}

