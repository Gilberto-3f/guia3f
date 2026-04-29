'use client'

import { Component, type ReactNode, useMemo } from 'react'
import type { VerificacaoSubabaId } from './SubabasVerificacao'
import { ListaPendentes } from './ListaPendentes'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { isAdmGeral } from '../../utils/permissoes'

function coerceSub(sub: string): VerificacaoSubabaId {
  if (sub === 'profissionais' || sub === 'empresas') return sub
  return 'turistas'
}

type BoundaryState = { error: Error | null }

class CadastrosErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(err: unknown): BoundaryState {
    return { error: err instanceof Error ? err : new Error(String(err)) }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          <p className="font-bold">Erro ao carregar Cadastros</p>
          <p className="whitespace-pre-wrap text-rose-800">{this.state.error.message}</p>
          <button
            type="button"
            className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            onClick={() => this.setState({ error: null })}
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function VerificacaoContainerInner({ sub }: { sub: string }) {
  const gate = useSharedAdminGate()
  const activeSub = useMemo(() => coerceSub(sub), [sub])

  if (gate.status === 'loading') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Carregando permissões…</div>
    )
  }

  if (gate.status !== 'ok') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Não foi possível confirmar sua sessão para esta área. Atualize a página ou faça login novamente.
      </div>
    )
  }

  const admin = gate.admin
  const perms = admin.admin_permissoes as unknown as { cargo?: string }
  const cargo = String(perms?.cargo ?? '').toUpperCase()

  const allowed =
    isAdmGeral(admin) ||
    ((cargo === 'FINANCEIRO' ? activeSub !== 'profissionais' : true) && (cargo === 'SUPORTE' ? activeSub === 'turistas' : true))

  return (
    <div className="space-y-4">
      {!allowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Você não tem permissão para acessar esta subaba.
        </div>
      ) : (
        <ListaPendentes tipo={activeSub} />
      )}
    </div>
  )
}

export function VerificacaoContainer({ sub }: { sub: string }) {
  return (
    <CadastrosErrorBoundary>
      <VerificacaoContainerInner sub={sub} />
    </CadastrosErrorBoundary>
  )
}
