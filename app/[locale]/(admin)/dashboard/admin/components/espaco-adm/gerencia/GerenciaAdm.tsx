'use client'

import { useState } from 'react'
import { Headphones, ShieldAlert, UserPlus, Users } from 'lucide-react'
import { AdminSecaoChevron } from '../../shared/AdminSecaoChevron'
import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'
import { ConvidarAdmin } from './ConvidarAdmin'
import { ListaAdmins } from './ListaAdmins'
import { AuxiliarAdmSuporte } from './AuxiliarAdmSuporte'

const COR_LOGO = '#0097b2'

export function GerenciaAdm() {
  const { isAdminGeral } = useGerenciaAdm()
  const [novoAberto, setNovoAberto] = useState(false)
  const [listaAberto, setListaAberto] = useState(false)
  const [auxiliarAberto, setAuxiliarAberto] = useState(false)
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
        titulo="Novo ADM"
        tituloGrande
        icone={UserPlus}
        corTitulo={COR_LOGO}
        aberta={novoAberto}
        onToggle={() => setNovoAberto((v) => !v)}
        descricao="Localize o usuário, defina função, comunidade e país (moderador) e envie o convite."
      >
        <ConvidarAdmin />
      </AdminSecaoChevron>

      <AdminSecaoChevron
        titulo="ADMs do aplicativo"
        tituloGrande
        icone={Users}
        corTitulo={COR_LOGO}
        aberta={listaAberto}
        onToggle={() => setListaAberto((v) => !v)}
        descricao="Colaboradores ativos e percentual de bonificação por pessoa."
      >
        <ListaAdmins />
      </AdminSecaoChevron>

      <AdminSecaoChevron
        titulo="Auxiliar ADM / Suporte"
        tituloGrande
        icone={Headphones}
        corTitulo={COR_LOGO}
        aberta={auxiliarAberto}
        onToggle={() => setAuxiliarAberto((v) => !v)}
        descricao="Empresas com plano Auxiliar ADM: autorize um colaborador nível 4 para gerenciar a conta."
      >
        <AuxiliarAdmSuporte />
      </AdminSecaoChevron>

      <AdminSecaoChevron
        titulo="Gestão de Advertências"
        tituloGrande
        icone={ShieldAlert}
        corTitulo={COR_LOGO}
        aberta={advertenciasAberto}
        onToggle={() => setAdvertenciasAberto((v) => !v)}
        descricao="Disponível quando o módulo de mobilidade estiver ativo."
      >
        <div className="rounded-2xl border border-dashed border-[#0097b2]/40 bg-[#0097b2]/5 px-4 py-8 text-center">
          <p className="text-sm font-bold text-[#0097b2]">Em breve</p>
          <p className="mt-2 text-xs leading-relaxed text-gray-600">
            A gestão de advertências e validação de decisões será habilitada junto com a mobilidade.
          </p>
        </div>
      </AdminSecaoChevron>
    </div>
  )
}
