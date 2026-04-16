'use client'

import { useMemo } from 'react'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { podeAcessar } from '../../utils/permissoes'
import type { ConfigSubabaId } from './SubabasConfig'
import { GestaoAPIs } from './GestaoAPIs'
import { LogsAuditoria } from './LogsAuditoria'
import { PoliticasEditaveis } from './PoliticasEditaveis'
import { SegurancaPlaceholder } from './SegurancaPlaceholder'

function coerceSub(sub: string): ConfigSubabaId {
  if (sub === 'logs' || sub === 'geral' || sub === 'seguranca') return sub
  return 'apis'
}

export function ConfiguracoesContainer({ sub }: { sub: string }) {
  const gate = useSharedAdminGate()
  const activeSub = useMemo(() => coerceSub(sub), [sub])

  if (gate.status !== 'ok') return null
  const admin = gate.admin

  const allowed =
    activeSub === 'apis'
      ? podeAcessar(admin, 'configuracoes.apis')
      : activeSub === 'logs'
        ? podeAcessar(admin, 'configuracoes.logs')
        : activeSub === 'geral'
          ? podeAcessar(admin, 'configuracoes.geral')
          : podeAcessar(admin, 'configuracoes.seguranca')

  return (
    <div className="space-y-4">
      {!allowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Você não tem permissão para acessar esta subaba.
        </div>
      ) : activeSub === 'apis' ? (
        <GestaoAPIs />
      ) : activeSub === 'logs' ? (
        <LogsAuditoria />
      ) : activeSub === 'geral' ? (
        <PoliticasEditaveis />
      ) : (
        <SegurancaPlaceholder />
      )}
    </div>
  )
}

