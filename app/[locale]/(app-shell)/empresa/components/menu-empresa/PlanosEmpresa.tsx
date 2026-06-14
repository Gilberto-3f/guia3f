'use client'

import { useMemo, useState } from 'react'
import { DollarSign } from 'lucide-react'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import ModalConfirmacao from '../shared/ModalConfirmacao'
import { usePlanos, corPlanoHex, labelServicoPlano, type PlanoEmpresa } from '../../hooks/usePlanos'

function normalizarPlanoAtual(plano: string, planos: PlanoEmpresa[]): PlanoEmpresa | null {
  const p = plano.trim().toLowerCase()
  return (
    planos.find(
      (item) =>
        item.nome.toLowerCase() === p ||
        item.titulo.toLowerCase() === p ||
        item.titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === p,
    ) ?? null
  )
}

export default function PlanosEmpresa() {
  const { dados: empresa } = useDashboardEmpresa()
  const { planos, loading, solicitando, solicitarMudanca } = usePlanos(empresa?.id ?? null)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [modal, setModal] = useState<{
    aberto: boolean
    tipo: 'upgrade' | 'downgrade'
    plano: PlanoEmpresa | null
  }>({
    aberto: false,
    tipo: 'upgrade',
    plano: null,
  })

  const planoAtual = useMemo(
    () => normalizarPlanoAtual(empresa?.plano ?? 'Básico', planos),
    [empresa?.plano, planos],
  )

  const indiceAtual = planoAtual ? planos.findIndex((p) => p.id === planoAtual.id) : -1

  const abrirSolicitacao = (tipo: 'upgrade' | 'downgrade', plano: PlanoEmpresa) => {
    setFeedback(null)
    setModal({ aberto: true, tipo, plano })
  }

  const confirmar = async () => {
    if (!modal.plano) return
    try {
      await solicitarMudanca(modal.tipo, modal.plano)
      setFeedback(`Solicitação enviada: ${modal.tipo.toUpperCase()} para ${modal.plano.titulo}.`)
    } catch {
      setFeedback('Não foi possível enviar a solicitação.')
    } finally {
      setModal({ aberto: false, tipo: 'upgrade', plano: null })
    }
  }

  return (
    <div className="space-y-6">
      {feedback ? <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{feedback}</div> : null}

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">Seu Plano Atual</h3>
        <div className="rounded-lg bg-gray-50 p-4 text-center">
          <p className="text-2xl font-bold text-[#001f3f]">{planoAtual?.titulo ?? empresa?.plano ?? '—'}</p>
          <p className="mt-1 text-sm text-gray-500">Solicite upgrade ou downgrade e um administrador entrará em contato.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-500">Carregando planos…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {planos.map((plano, idx) => {
            const isCurrent = planoAtual?.id === plano.id
            const cor = corPlanoHex(plano.cor)
            const isUpgrade = !isCurrent && indiceAtual >= 0 && idx > indiceAtual

            return (
              <div
                key={plano.id}
                className={[
                  'rounded-lg border bg-white p-4',
                  isCurrent ? 'ring-2 ring-offset-1' : 'border-gray-200',
                ].join(' ')}
                style={isCurrent ? { borderColor: cor, boxShadow: `0 0 0 1px ${cor}` } : undefined}
              >
                <div className="h-1 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: cor }}
                  >
                    <DollarSign className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </span>
                  <h4 className="text-lg font-bold text-[#001f3f]">{plano.titulo}</h4>
                </div>

                {plano.descricao ? <p className="mt-2 text-sm text-gray-600">{plano.descricao}</p> : null}

                <div className="mt-3 space-y-1 text-sm text-gray-800">
                  <p>
                    <span className="font-semibold" style={{ color: cor }}>
                      Mensal:
                    </span>{' '}
                    R$ {plano.precoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">Trimestral:</span> R${' '}
                    {plano.precoTrimestral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">Anual:</span> R${' '}
                    {plano.precoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {plano.servicos.length > 0 ? (
                  <ul className="mt-4 space-y-1.5 text-xs text-gray-600">
                    {plano.servicos.map((sid) => (
                      <li key={sid} className="flex gap-1.5">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
                        <span>{labelServicoPlano(sid)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (isCurrent) return
                    abrirSolicitacao(isUpgrade ? 'upgrade' : 'downgrade', plano)
                  }}
                  disabled={isCurrent || solicitando}
                  className="mt-4 w-full rounded-lg py-2 text-sm font-bold text-white disabled:opacity-50"
                  style={{
                    backgroundColor: isCurrent ? '#9ca3af' : isUpgrade ? cor : '#4b5563',
                  }}
                >
                  {isCurrent ? 'Plano Atual' : isUpgrade ? 'Solicitar Upgrade' : 'Solicitar Downgrade'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
        Downgrades são analisados pela equipe. Um administrador entrará em contato.
      </div>

      <ModalConfirmacao
        aberto={modal.aberto}
        titulo={modal.tipo === 'upgrade' ? 'Solicitar upgrade?' : 'Solicitar downgrade?'}
        descricao={modal.plano ? `Plano: ${modal.plano.titulo}` : undefined}
        confirmarLabel={modal.tipo === 'upgrade' ? 'Solicitar upgrade' : 'Solicitar downgrade'}
        confirmando={solicitando}
        onConfirmar={() => void confirmar()}
        onCancelar={() => setModal({ aberto: false, tipo: 'upgrade', plano: null })}
      />
    </div>
  )
}
