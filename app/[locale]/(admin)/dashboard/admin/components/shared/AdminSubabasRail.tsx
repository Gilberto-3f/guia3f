'use client'

import { useMemo, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { AbaPrincipalId } from './AbasNavegacao'
import { SubabasVisaoNav, type VisaoSubabaId } from '../visao-geral/SubabasVisaoNav'
import { SubabasVerificacao, type VerificacaoSubabaId } from '../verificacao/SubabasVerificacao'
import SubabasDenuncias from '../denuncias/SubabasDenuncias'
import { SubabasEspaco, type EspacoSubabaId } from '../espaco-adm/SubabasEspaco'
import { SubabasConfig, type ConfigSubabaId } from '../configuracoes/SubabasConfig'
import { useVerificacao } from '../../hooks/useVerificacao'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { isAdmGeral } from '../../utils/permissoes'
import { useDenunciasToolbar } from '../../context/DenunciasToolbarContext'
import { usePermissao } from '../../hooks/usePermissao'

function coerceVisaoSub(sub: string): VisaoSubabaId {
  if (sub === 'profissionais' || sub === 'empresas') return sub
  return 'turistas'
}

function coerceVerificacaoSub(sub: string): VerificacaoSubabaId {
  if (sub === 'profissionais' || sub === 'empresas') return sub
  return 'turistas'
}

function coerceDenunciasSub(sub: string): 'turistas' | 'profissionais' | 'empresas' {
  if (sub === 'profissionais' || sub === 'empresas') return sub
  return 'turistas'
}

function coerceEspacoSub(sub: string): EspacoSubabaId {
  if (sub === 'empresas' || sub === 'financeiro' || sub === 'gerencia') return sub
  return 'graficos'
}

function coerceConfigSub(sub: string): ConfigSubabaId {
  if (sub === 'logs' || sub === 'geral' || sub === 'seguranca') return sub
  return 'apis'
}

function CadastrosSubNav({ sub }: { sub: string }) {
  const activeSub = useMemo(() => coerceVerificacaoSub(sub), [sub])
  const { contadores } = useVerificacao({
    perfil: activeSub,
    periodo: '7d',
    busca: '',
    categoria: 'todas',
  })
  return <SubabasVerificacao value={activeSub} badges={contadores} />
}

function DenunciasSubNav({ sub }: { sub: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const { nivel } = usePermissao()
  const { badges } = useDenunciasToolbar()

  const nivelNum = typeof nivel === 'string' ? parseInt(nivel, 10) : nivel
  const podeVerProfissionais = nivelNum === 1 || nivelNum === 2
  const podeVerEmpresas = nivelNum === 1 || nivelNum === 3

  const perfilAtivo = useMemo(() => coerceDenunciasSub(sub), [sub])

  const onPerfilChange = (p: 'turistas' | 'profissionais' | 'empresas') => {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', 'denuncias')
    params.set('sub', p)
    router.replace(`?${params.toString()}`)
  }

  return (
    <SubabasDenuncias
      perfilAtivo={perfilAtivo}
      onPerfilChange={onPerfilChange}
      podeVerProfissionais={podeVerProfissionais}
      podeVerEmpresas={podeVerEmpresas}
      badges={badges}
    />
  )
}

export function AdminSubabasRail({ tab, sub }: { tab: AbaPrincipalId; sub: string }) {
  const gate = useSharedAdminGate()

  const metaCadastros =
    gate.status === 'ok' ? (
      <span className="hidden text-xs font-semibold text-gray-500 sm:inline">
        {isAdmGeral(gate.admin) ? 'ADM GERAL' : 'ADMIN'} · permissões por subaba
      </span>
    ) : null

  const metaEspaco =
    gate.status === 'ok' ? (
      <span className="hidden text-xs font-semibold text-gray-500 sm:inline">
        {isAdmGeral(gate.admin) ? 'ADM GERAL' : 'ADMIN'}
      </span>
    ) : null

  let inner: ReactNode = null
  let meta: ReactNode = null

  switch (tab) {
    case 'visao-geral':
      inner = <SubabasVisaoNav value={coerceVisaoSub(sub)} />
      break
    case 'cadastros':
      inner = <CadastrosSubNav sub={sub} />
      meta = metaCadastros
      break
    case 'denuncias':
      inner = <DenunciasSubNav sub={sub} />
      break
    case 'espaco-adm':
      inner = <SubabasEspaco value={coerceEspacoSub(sub)} />
      meta = metaEspaco
      break
    case 'configuracoes':
      inner = <SubabasConfig value={coerceConfigSub(sub)} />
      break
    default:
      inner = null
  }

  if (!inner) return null

  return (
    <div className="mt-2 -mx-2 border-y border-gray-200 bg-gray-50/95 px-2 py-2.5 sm:-mx-4 sm:px-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">{inner}</div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
    </div>
  )
}
