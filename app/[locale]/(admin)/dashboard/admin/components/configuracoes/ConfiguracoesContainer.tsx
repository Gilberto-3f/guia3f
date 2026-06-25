'use client'

import { useMemo } from 'react'
import { useAdminNav } from '../../context/AdminNavContext'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { podeAcessar } from '../../utils/permissoes'
import { ConfiguracoesTabs, coerceConfigSubaba } from './ConfiguracoesTabs'
import { GestaoAPIs } from './GestaoAPIs'
import { PoliticasEditaveis } from './PoliticasEditaveis'
import { SegurancaPlaceholder } from './SegurancaPlaceholder'

export function ConfiguracoesBarraFixa({ sub }: { sub: string }) {
  const { selectSub } = useAdminNav()
  const activeSub = useMemo(() => coerceConfigSubaba(sub), [sub])

  return (
    <div className="border-t border-gray-100 bg-white px-3 py-2.5 sm:px-4">
      <ConfiguracoesTabs
        value={activeSub}
        onChange={(next) => selectSub('configuracoes', next)}
      />
    </div>
  )
}

export function ConfiguracoesContainer({ sub }: { sub: string }) {
  const gate = useSharedAdminGate()
  const activeSub = useMemo(() => coerceConfigSubaba(sub), [sub])

  if (gate.status !== 'ok') return null
  const admin = gate.admin

  const allowed =
    activeSub === 'apis'
      ? podeAcessar(admin, 'configuracoes.apis')
      : activeSub === 'geral'
        ? podeAcessar(admin, 'configuracoes.geral')
        : podeAcessar(admin, 'configuracoes.seguranca')

  return (
    <div className="space-y-4">
      {!allowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Você não tem permissão para acessar esta seção.
        </div>
      ) : activeSub === 'apis' ? (
        <GestaoAPIs />
      ) : activeSub === 'geral' ? (
        <PoliticasEditaveis />
      ) : (
        <SegurancaPlaceholder />
      )}
    </div>
  )
}
