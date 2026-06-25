'use client'

import { useMemo, type ReactNode } from 'react'
import type { AbaPrincipalId } from './AbasNavegacao'
import SubabasDenuncias from '../denuncias/SubabasDenuncias'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { isAdmGeral } from '../../utils/permissoes'
import { useDenunciasToolbar } from '../../context/DenunciasToolbarContext'
import { usePermissao } from '../../hooks/usePermissao'
import { useAdminNav } from '../../context/AdminNavContext'

function coerceDenunciasSub(sub: string): 'turistas' | 'profissionais' | 'empresas' | 'auditoria' {
  if (sub === 'profissionais' || sub === 'empresas' || sub === 'auditoria') return sub
  return 'turistas'
}

function DenunciasSubNav({ sub }: { sub: string }) {
  const { selectSub } = useAdminNav()
  const gate = useSharedAdminGate()
  const { nivel } = usePermissao()
  const { badgesPendentes, badgesExclusao } = useDenunciasToolbar()

  const nivelNum = typeof nivel === 'string' ? parseInt(nivel, 10) : nivel
  const podeVerProfissionais = nivelNum === 1 || nivelNum === 2
  const podeVerEmpresas = nivelNum === 1 || nivelNum === 3
  const mostrarBadgeExclusao = gate.status === 'ok' && isAdmGeral(gate.admin)
  const perfilAtivo = useMemo(() => coerceDenunciasSub(sub), [sub])

  const onPerfilChange = (p: 'turistas' | 'profissionais' | 'empresas' | 'auditoria') => {
    selectSub('denuncias', p)
  }

  return (
    <SubabasDenuncias
      perfilAtivo={perfilAtivo}
      onPerfilChange={onPerfilChange}
      podeVerProfissionais={podeVerProfissionais}
      podeVerEmpresas={podeVerEmpresas}
      badgesPendentes={badgesPendentes}
      badgesExclusao={badgesExclusao}
      mostrarBadgeExclusao={mostrarBadgeExclusao}
    />
  )
}

export function AdminSubabasRail({ tab, sub }: { tab: AbaPrincipalId; sub: string }) {
  let inner: ReactNode = null
  let meta: ReactNode = null

  switch (tab) {
    case 'visao-geral':
      return null
    case 'cadastros':
      return null
    case 'espaco-adm':
      return null
    case 'configuracoes':
      return null
    case 'denuncias':
      inner = <DenunciasSubNav sub={sub} />
      break
    default:
      inner = null
  }

  if (!inner) return null

  return (
    <div className="mt-2 -mx-3 bg-gray-50/95 px-3 py-2.5 sm:-mx-4 sm:px-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">{inner}</div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
    </div>
  )
}
