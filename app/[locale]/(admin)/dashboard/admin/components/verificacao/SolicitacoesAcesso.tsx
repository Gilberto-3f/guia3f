'use client'

import { useMemo, useState } from 'react'
import { useSolicitacoesAcesso } from '../../hooks/useSolicitacoesAcesso'
import type { SolicitacaoAcesso } from '../../types/admin.types'
import CardSolicitacao from './CardSolicitacao'
import ModalAprovarSolicitacao from './ModalAprovarSolicitacao'

export default function SolicitacoesAcesso() {
  const { solicitacoes, loading, error, filtro, setFiltro, aprovarSolicitacao, recusarSolicitacao, revogarAcesso, executarLimpezaExpirados, isAdminGeral, refetch } =
    useSolicitacoesAcesso()
  const [modalAberto, setModalAberto] = useState(false)
  const [modalModo, setModalModo] = useState<'aprovar' | 'recusar'>('aprovar')
  const [selecionada, setSelecionada] = useState<SolicitacaoAcesso | null>(null)
  const [executandoLimpeza, setExecutandoLimpeza] = useState(false)
  const [mensagemLimpeza, setMensagemLimpeza] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  const counts = useMemo(
    () => ({
      pendentes: solicitacoes.filter((s) => s.status === 'pendente').length,
      aprovadas: solicitacoes.filter((s) => s.status === 'aprovado').length,
      recusadas: solicitacoes.filter((s) => s.status === 'recusado').length,
      revogadas: solicitacoes.filter((s) => s.status === 'revogado').length,
      expiradas: solicitacoes.filter((s) => s.status === 'expirado').length,
    }),
    [solicitacoes]
  )

  if (!isAdminGeral) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Apenas ADM GERAL pode acessar esta área.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="mt-2 h-3 w-2/3 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <div>Erro ao carregar solicitações: {error.message}</div>
        <button type="button" onClick={() => void refetch()} className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white">
          Tentar novamente
        </button>
      </div>
    )
  }

  const handleExecutarLimpeza = async () => {
    if (!window.confirm('Executar limpeza de acessos expirados agora?')) return
    setExecutandoLimpeza(true)
    setMensagemLimpeza(null)
    try {
      const resultado = await executarLimpezaExpirados()
      const qtd = Number(resultado?.quantidade_expirados ?? 0)
      setMensagemLimpeza({
        tipo: 'sucesso',
        texto: `${qtd} acessos expirados foram processados nesta execução.`,
      })
    } catch {
      setMensagemLimpeza({
        tipo: 'erro',
        texto: 'Erro ao executar limpeza. Tente novamente.',
      })
    } finally {
      setExecutandoLimpeza(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-bold text-gray-900">Solicitações de acesso</h3>
        {isAdminGeral ? (
          <button
            type="button"
            onClick={() => void handleExecutarLimpeza()}
            disabled={executandoLimpeza}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {executandoLimpeza ? 'Processando...' : 'Executar limpeza agora'}
          </button>
        ) : null}
      </div>

      {mensagemLimpeza ? (
        <div className={`rounded-lg p-3 text-xs ${mensagemLimpeza.tipo === 'sucesso' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {mensagemLimpeza.texto}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button type="button" onClick={() => setFiltro('pendentes')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'pendentes' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}>
          Pendentes ({counts.pendentes})
        </button>
        <button type="button" onClick={() => setFiltro('aprovadas')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'aprovadas' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}>
          Aprovadas ({counts.aprovadas})
        </button>
        <button type="button" onClick={() => setFiltro('recusadas')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'recusadas' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}>
          Recusadas ({counts.recusadas})
        </button>
        <button type="button" onClick={() => setFiltro('revogadas')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'revogadas' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}>
          Revogadas ({counts.revogadas})
        </button>
        <button type="button" onClick={() => setFiltro('expiradas')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === 'expiradas' ? 'bg-[#e6f7fa] text-[#007d94]' : 'bg-gray-100 text-gray-600'}`}>
          Expiradas ({counts.expiradas})
        </button>
      </div>

      {solicitacoes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">Nenhuma solicitação para o filtro selecionado.</div>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map((solicitacao) => (
            <CardSolicitacao
              key={solicitacao.id}
              solicitacao={solicitacao}
              onAprovar={() => {
                setSelecionada(solicitacao)
                setModalModo('aprovar')
                setModalAberto(true)
              }}
              onRecusar={() => {
                setSelecionada(solicitacao)
                setModalModo('recusar')
                setModalAberto(true)
              }}
              onRevogar={async () => {
                const motivo = window.prompt('Motivo da revogação:')
                if (!motivo) return
                await revogarAcesso({ solicitacao_id: solicitacao.id, motivo })
              }}
            />
          ))}
        </div>
      )}

      <ModalAprovarSolicitacao
        aberto={modalAberto}
        modo={modalModo}
        solicitacao={selecionada}
        onClose={() => setModalAberto(false)}
        onConfirmAprovar={async (diasAcesso) => {
          if (!selecionada) return
          const concederAcessoAte = diasAcesso ? new Date(Date.now() + diasAcesso * 24 * 60 * 60 * 1000) : undefined
          await aprovarSolicitacao({ solicitacao_id: selecionada.id, conceder_acesso_ate: concederAcessoAte })
        }}
        onConfirmRecusar={async (motivo) => {
          if (!selecionada) return
          await recusarSolicitacao({ solicitacao_id: selecionada.id, motivo })
        }}
      />
    </div>
  )
}
