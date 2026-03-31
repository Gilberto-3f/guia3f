'use client'

import { useMemo } from 'react'
import { useAdminGate } from '../../hooks/usePermissao'
import { podeAcessar } from '../../utils/permissoes'
import { SubabasConfig, type ConfigSubabaId } from './SubabasConfig'
import { GestaoAPIs } from './GestaoAPIs'
import { LogsAuditoria } from './LogsAuditoria'
import { PoliticasEditaveis } from './PoliticasEditaveis'
import { SegurancaPlaceholder } from './SegurancaPlaceholder'

function coerceSub(sub: string): ConfigSubabaId {
  if (sub === 'logs' || sub === 'geral' || sub === 'seguranca') return sub
  return 'apis'
}

export function ConfiguracoesContainer({ sub }: { sub: string }) {
  const gate = useAdminGate()
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
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <SubabasConfig value={activeSub} />
      </div>

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

