'use client'

import { useEffect, useState } from 'react'
import type { SolicitacaoAcesso } from '../../types/admin.types'

export default function ModalAprovarSolicitacao({
  aberto,
  modo,
  solicitacao,
  onClose,
  onConfirmAprovar,
  onConfirmRecusar,
}: {
  aberto: boolean
  modo: 'aprovar' | 'recusar'
  solicitacao: SolicitacaoAcesso | null
  onClose: () => void
  onConfirmAprovar: (diasAcesso: number | null) => Promise<void>
  onConfirmRecusar: (motivo: string) => Promise<void>
}) {
  const [acessoTemporario, setAcessoTemporario] = useState(false)
  const [dias, setDias] = useState(7)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setAcessoTemporario(false)
    setDias(7)
    setMotivo('')
    setSaving(false)
  }, [aberto, modo, solicitacao?.id])

  if (!aberto || !solicitacao) return null

  const onSubmit = async () => {
    setSaving(true)
    try {
      if (modo === 'aprovar') {
        await onConfirmAprovar(acessoTemporario ? dias : null)
      } else {
        await onConfirmRecusar(motivo)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold text-gray-900">{modo === 'aprovar' ? 'Aprovar solicitação' : 'Recusar solicitação'}</h3>
        <div className="mt-3 space-y-1 text-sm text-gray-600">
          <div>Solicitante: {solicitacao.solicitante_nome || '-'}</div>
          <div>Perfil: {solicitacao.perfil_nome || '-'} (@{solicitacao.perfil_username || '-'})</div>
          <div>Motivo: {solicitacao.motivo || 'Nao informado'}</div>
        </div>

        {modo === 'aprovar' ? (
          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={acessoTemporario} onChange={(e) => setAcessoTemporario(e.target.checked)} />
              Conceder acesso temporario
            </label>
            {acessoTemporario ? (
              <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 p-2 text-sm">
                <option value={1}>1 dia</option>
                <option value={3}>3 dias</option>
                <option value={7}>7 dias</option>
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
              </select>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Motivo da recusa</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 p-2 text-sm"
              placeholder="Informe o motivo"
            />
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || (modo === 'recusar' && !motivo.trim())}
            className="flex-1 rounded-lg bg-[#0097b2] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvando...' : modo === 'aprovar' ? 'Aprovar' : 'Recusar'}
          </button>
        </div>
      </div>
    </div>
  )
}
