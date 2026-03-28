'use client'

import { useMemo } from 'react'
import { SubabasVerificacao, type VerificacaoSubabaId } from './SubabasVerificacao'
import { ListaPendentes } from './ListaPendentes'
import SolicitacoesAcesso from './SolicitacoesAcesso'
import { useAdminGate } from '../../hooks/usePermissao'
import { isAdmGeral } from '../../utils/permissoes'
import { useVerificacao } from '../../hooks/useVerificacao'

function coerceSub(sub: string): VerificacaoSubabaId {
  if (sub === 'profissionais' || sub === 'empresas') return sub
  return 'turistas'
}

export function VerificacaoContainer({ sub }: { sub: string }) {
  const gate = useAdminGate()
  const activeSub = useMemo(() => coerceSub(sub), [sub])

  if (gate.status !== 'ok') return null

  const admin = gate.admin
  const { contadores } = useVerificacao({ perfil: activeSub, periodo: '7d', busca: '', categoria: 'todas' })

  const perms = admin.admin_permissoes as unknown as { cargo?: string }
  const cargo = String(perms?.cargo ?? '').toUpperCase()

  const allowed =
    isAdmGeral(admin) ||
    (cargo === 'FINANCEIRO' ? activeSub !== 'profissionais' : true) &&
      (cargo === 'SUPORTE' ? activeSub === 'turistas' : true)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SubabasVerificacao value={activeSub} badges={contadores} />
          <div className="text-xs font-semibold text-gray-500">
            {isAdmGeral(admin) ? 'ADM GERAL' : 'ADMIN'} · permissões aplicadas por subaba
          </div>
        </div>
      </div>

      {!allowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Você não tem permissão para acessar esta subaba.
        </div>
      ) : (
        <ListaPendentes tipo={activeSub} />
      )}

      {isAdmGeral(admin) ? (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-bold text-gray-900">Solicitações de acesso a documentos</div>
          <SolicitacoesAcesso />
        </div>
      ) : null}
    </div>
  )
}

