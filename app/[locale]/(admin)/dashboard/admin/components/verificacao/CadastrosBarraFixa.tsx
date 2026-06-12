'use client'

import { useMemo } from 'react'
import { SubabasVerificacao, type VerificacaoSubabaId } from './SubabasVerificacao'
import { useVerificacao } from '../../hooks/useVerificacao'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { isAdmGeral } from '../../utils/permissoes'
import type { PerfilVerificacao } from '../../types/admin.types'

function coerceSub(sub: string): VerificacaoSubabaId {
  if (sub === 'profissionais' || sub === 'empresas' || sub === 'auditoria') return sub
  return 'turistas'
}

export function CadastrosBarraFixa({ sub }: { sub: string }) {
  const gate = useSharedAdminGate()
  const activeSub = useMemo(() => coerceSub(sub), [sub])
  const perfilContadores: PerfilVerificacao = activeSub === 'auditoria' ? 'turistas' : activeSub
  const { contadores, contadoresExclusao } = useVerificacao({ perfil: perfilContadores })
  const mostrarBadgeExclusao = gate.status === 'ok' && isAdmGeral(gate.admin)

  return (
    <div className="space-y-2.5 border-t border-gray-100 bg-white px-3 py-2.5 sm:px-4">
      <SubabasVerificacao
        value={activeSub}
        badges={contadores}
        badgesExclusao={contadoresExclusao}
        mostrarBadgeExclusao={mostrarBadgeExclusao}
      />
    </div>
  )
}
