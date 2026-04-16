'use client'

import { Component, type ReactNode, useMemo } from 'react'
import { SubabasVerificacao, type VerificacaoSubabaId } from './SubabasVerificacao'
import { ListaPendentes } from './ListaPendentes'
import SolicitacoesAcesso from './SolicitacoesAcesso'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { isAdmGeral } from '../../utils/permissoes'
import { useVerificacao } from '../../hooks/useVerificacao'

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

  const { contadores, error: erroContadores } = useVerificacao({
    perfil: activeSub,
    periodo: '7d',
    busca: '',
    categoria: 'todas',
  })

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
      {erroContadores ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Não foi possível carregar os contadores de pendentes: {erroContadores.message}
        </div>
      ) : null}

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

export function VerificacaoContainer({ sub }: { sub: string }) {
  return (
    <CadastrosErrorBoundary>
      <VerificacaoContainerInner sub={sub} />
    </CadastrosErrorBoundary>
  )
}
