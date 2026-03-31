'use client'

import { useState } from 'react'
import { usePermissao } from '../../hooks/usePermissao'

export default function AcoesDenuncia({
  aberto,
  onClose,
  denuncia,
  onMarcarInvestigacao,
  onAplicarPenalidade,
  onArquivar,
}: {
  aberto: boolean
  onClose: () => void
  denuncia: any
  onMarcarInvestigacao: () => Promise<void>
  onAplicarPenalidade: (payload: { acao: 'advertir' | 'suspender' | 'banir'; suspensao_dias?: number; motivo: string }) => Promise<void>
  onArquivar: (motivo: string) => Promise<void>
}) {
  const { podeExecutarRecurso } = usePermissao()
  const [acaoSelecionada, setAcaoSelecionada] = useState<string | null>(null)
  const [diasSuspensao, setDiasSuspensao] = useState(7)
  const [motivo, setMotivo] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [saving, setSaving] = useState(false)

  if (!aberto) return null

  const podeAdvertir = podeExecutarRecurso('advertir')
  const podeSuspender = podeExecutarRecurso('suspender')
  const podeBanir = podeExecutarRecurso('banir')
  const podeArquivar = podeExecutarRecurso('arquivar')

  const resetAndClose = () => {
    setAcaoSelecionada(null)
    setDiasSuspensao(7)
    setMotivo('')
    setConfirmacao('')
    onClose()
  }

  const run = async (fn: () => Promise<void>) => {
    setSaving(true)
    try {
      await fn()
      resetAndClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Ações da denúncia</h3>
          <button type="button" onClick={resetAndClose} className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100">
            ✕
          </button>
        </div>

        {!acaoSelecionada ? (
          <div className="space-y-2">
            {denuncia?.status === 'pendente' ? (
              <button type="button" onClick={() => void run(onMarcarInvestigacao)} className="w-full rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-left text-sm font-semibold text-yellow-900">
                Marcar em investigação
              </button>
            ) : null}
            {podeAdvertir ? (
              <button type="button" onClick={() => setAcaoSelecionada('advertir')} className="w-full rounded-lg border border-gray-200 p-3 text-left text-sm hover:bg-gray-50">
                Advertir
              </button>
            ) : null}
            {podeSuspender ? (
              <button type="button" onClick={() => setAcaoSelecionada('suspender')} className="w-full rounded-lg border border-gray-200 p-3 text-left text-sm hover:bg-gray-50">
                Suspender
              </button>
            ) : null}
            {podeBanir ? (
              <button type="button" onClick={() => setAcaoSelecionada('banir')} className="w-full rounded-lg border border-gray-200 p-3 text-left text-sm hover:bg-gray-50">
                Banir permanentemente
              </button>
            ) : null}
            {podeArquivar ? (
              <button type="button" onClick={() => setAcaoSelecionada('arquivar')} className="w-full rounded-lg border border-gray-200 p-3 text-left text-sm hover:bg-gray-50">
                Arquivar denúncia
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {acaoSelecionada === 'suspender' ? (
              <select value={diasSuspensao} onChange={(e) => setDiasSuspensao(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 p-2 text-sm">
                <option value={7}>7 dias</option>
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
              </select>
            ) : null}
            {acaoSelecionada === 'banir' ? (
              <input
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder="Digite BANIR para confirmar"
                className="w-full rounded-lg border border-red-200 p-2 text-sm"
              />
            ) : null}
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 p-2 text-sm"
              placeholder="Motivo obrigatório"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setAcaoSelecionada(null)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                Voltar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (!motivo.trim()) return
                  if (acaoSelecionada === 'advertir') {
                    void run(() => onAplicarPenalidade({ acao: 'advertir', motivo }))
                    return
                  }
                  if (acaoSelecionada === 'suspender') {
                    void run(() => onAplicarPenalidade({ acao: 'suspender', motivo, suspensao_dias: diasSuspensao }))
                    return
                  }
                  if (acaoSelecionada === 'banir') {
                    if (confirmacao !== 'BANIR') return
                    void run(() => onAplicarPenalidade({ acao: 'banir', motivo }))
                    return
                  }
                  if (acaoSelecionada === 'arquivar') {
                    void run(() => onArquivar(motivo))
                  }
                }}
                className="flex-1 rounded-lg bg-[#0097b2] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}