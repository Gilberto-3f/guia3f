'use client'

import { Trash2 } from 'lucide-react'

export function ModalSolicitarExclusao({
  aberto,
  motivo,
  onMotivoChange,
  onConfirmar,
  onFechar,
  enviando,
}: {
  aberto: boolean
  motivo: string
  onMotivoChange: (v: string) => void
  onConfirmar: () => void
  onFechar: () => void
  enviando?: boolean
}) {
  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-exclusao-titulo"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-[#0097b2]" aria-hidden />
          <h3 id="modal-exclusao-titulo" className="text-base font-bold text-gray-900">
            Solicitar exclusão
          </h3>
        </div>

        <label className="mt-4 block text-xs font-semibold text-gray-700" htmlFor="motivo-exclusao">
          Motivo da solicitação
        </label>
        <textarea
          id="motivo-exclusao"
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none ring-[#0097b2]/30 focus:border-[#0097b2] focus:ring-2"
          placeholder="Descreva o motivo..."
          autoFocus
        />

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!motivo.trim() || enviando}
            onClick={onConfirmar}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0097b2] px-4 text-sm font-bold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {enviando ? 'Enviando…' : 'Confirmar solicitação'}
          </button>
        </div>
      </div>
    </div>
  )
}
