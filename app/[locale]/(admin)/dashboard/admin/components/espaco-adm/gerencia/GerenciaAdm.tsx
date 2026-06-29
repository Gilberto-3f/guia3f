'use client'

import { useState } from 'react'
import { ShieldAlert, UserPlus } from 'lucide-react'
import { AdminSecaoChevron } from '../../shared/AdminSecaoChevron'
import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'
import { ConvidarAdmin } from './ConvidarAdmin'
import { ListaAdmins } from './ListaAdmins'
import { PagamentosColaboradores } from './PagamentosColaboradores'
import { GestaoAdvertencias } from './GestaoAdvertencias'

const COR_LOGO = '#0097b2'

export function GerenciaAdm() {
  const { isAdminGeral } = useGerenciaAdm()
  const [convidarAberto, setConvidarAberto] = useState(false)
  const [advertenciasAberto, setAdvertenciasAberto] = useState(false)

  if (!isAdminGeral) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Apenas ADM GERAL pode acessar esta área.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <AdminSecaoChevron
        titulo="Convidar NOVO ADM"
        tituloGrande
        icone={UserPlus}
        corTitulo={COR_LOGO}
        aberta={convidarAberto}
        onToggle={() => setConvidarAberto((v) => !v)}
        descricao="Localize o username, escolha a função e envie o convite. O usuário receberá um popup para aceitar ou recusar."
      >
        <ConvidarAdmin />
        <ListaAdmins />
      </AdminSecaoChevron>

      <AdminSecaoChevron
        titulo="Gestão de advertências"
        tituloGrande
        icone={ShieldAlert}
        corTitulo={COR_LOGO}
        aberta={advertenciasAberto}
        onToggle={() => setAdvertenciasAberto((v) => !v)}
        descricao="Valide decisões dos ADMs e gerencie a tabela de infrações do ecossistema."
      >
        <GestaoAdvertencias />
      </AdminSecaoChevron>

      <PagamentosColaboradores />
    </div>
  )
}
