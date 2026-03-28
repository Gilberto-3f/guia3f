'use client'

import { useMemo, useState } from 'react'
import { useDashboardEmpresa } from '@/app/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import ModalConfirmacao from '../shared/ModalConfirmacao'
import { usePlanos, type PlanoId } from '../../hooks/usePlanos'

function upperPlano(plano: string) {
  const p = plano.toLowerCase()
  if (p.includes('enterprise')) return 'ENTERPRISE'
  if (p.includes('premium')) return 'PREMIUM'
  return 'BASICO'
}

export default function PlanosEmpresa() {
  const { dados: empresa } = useDashboardEmpresa()
  const { planos, solicitando, solicitarMudanca } = usePlanos(empresa?.id ?? null)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [modal, setModal] = useState<{ aberto: boolean; tipo: 'upgrade' | 'downgrade'; plano: PlanoId | null }>({
    aberto: false,
    tipo: 'upgrade',
    plano: null,
  })

  const planoAtual = useMemo(() => upperPlano(empresa?.plano ?? 'Básico'), [empresa?.plano])

  const abrirSolicitacao = (tipo: 'upgrade' | 'downgrade', plano: PlanoId) => {
    setFeedback(null)
    setModal({ aberto: true, tipo, plano })
  }

  const confirmar = async () => {
    if (!modal.plano) return
    try {
      await solicitarMudanca(modal.tipo, modal.plano)
      setFeedback(`✅ Solicitação enviada: ${modal.tipo.toUpperCase()} para ${modal.plano}.`)
    } catch {
      setFeedback('❌ Não foi possível enviar a solicitação.')
    } finally {
      setModal({ aberto: false, tipo: 'upgrade', plano: null })
    }
  }

  return (
    <div className="space-y-6">
      {feedback ? <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{feedback}</div> : null}

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">💎 Seu Plano Atual</h3>
        <div className="rounded-lg bg-gray-50 p-4 text-center">
          <p className="text-2xl font-bold text-[#001f3f]">{planoAtual}</p>
          <p className="mt-1 text-sm text-gray-500">Solicite upgrade/downgrade e um administrador entrará em contato.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {planos.map((plano) => {
          const isCurrent = plano.nome === planoAtual

          const isUpgrade =
            !isCurrent &&
            ((planoAtual === 'BASICO' && plano.nome !== 'BASICO') || (planoAtual === 'PREMIUM' && plano.nome === 'ENTERPRISE'))

          return (
            <div key={plano.nome} className={`rounded-lg border p-4 ${isCurrent ? 'border-[#0097b2] bg-blue-50' : ''}`}>
              <h4 className="text-xl font-bold text-[#001f3f]">{plano.nome}</h4>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                R$ {plano.valor}
                <span className="text-sm font-normal text-gray-500">/mês</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li>📸 {plano.recursos.fotos} fotos</li>
                <li>{plano.recursos.publicidade ? '✅ Publicidade disponível' : '❌ Sem publicidade'}</li>
                <li>{plano.recursos.estatisticas ? '✅ Estatísticas completas' : '❌ Estatísticas básicas'}</li>
                <li>{plano.recursos.suporte_prioritario ? '⭐ Suporte prioritário' : '📧 Suporte padrão'}</li>
              </ul>

              <button
                type="button"
                onClick={() => {
                  if (isCurrent) return
                  abrirSolicitacao(isUpgrade ? 'upgrade' : 'downgrade', plano.nome)
                }}
                disabled={isCurrent || solicitando}
                className={`mt-4 w-full rounded-lg py-2 text-white disabled:opacity-50 ${
                  isCurrent ? 'bg-gray-400' : isUpgrade ? 'bg-[#0097b2] hover:bg-[#007a91]' : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {isCurrent ? 'Plano Atual' : isUpgrade ? 'Solicitar Upgrade' : 'Solicitar Downgrade'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
        ℹ️ Downgrades são analisados pela equipe. Um administrador entrará em contato.
      </div>

      <ModalConfirmacao
        aberto={modal.aberto}
        titulo={modal.tipo === 'upgrade' ? 'Solicitar upgrade?' : 'Solicitar downgrade?'}
        descricao={modal.plano ? `Plano: ${modal.plano}` : undefined}
        confirmarLabel={modal.tipo === 'upgrade' ? 'Solicitar upgrade' : 'Solicitar downgrade'}
        confirmando={solicitando}
        onConfirmar={() => void confirmar()}
        onCancelar={() => setModal({ aberto: false, tipo: 'upgrade', plano: null })}
      />
    </div>
  )
}

