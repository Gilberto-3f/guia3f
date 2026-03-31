'use client'

import { useState } from 'react'

export function AprovacaoLote({
  selecionados,
  todosVerificados,
  processando,
  onAprovar,
  onSelecionarTodos,
  onLimparSelecao,
}: {
  selecionados: string[]
  todosVerificados: boolean
  processando: boolean
  onAprovar: () => void
  onSelecionarTodos: () => void
  onLimparSelecao: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  if (selecionados.length <= 0) return null

  return (
    <div className="sticky bottom-4 z-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="text-sm font-semibold text-gray-800">
          Selecionados: {selecionados.length}
          {!todosVerificados ? <div className="text-xs text-amber-700">Aprovação em lote exige docs verificados</div> : null}
        </div>
        <button type="button" onClick={onLimparSelecao} className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          Limpar
        </button>
        <button type="button" onClick={onSelecionarTodos} className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          Selecionar todos verificados
        </button>
        {confirmando ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setConfirmando(false)} className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700">
              Cancelar
            </button>
            <button
              type="button"
              onClick={onAprovar}
              disabled={!todosVerificados || processando}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processando ? 'Processando...' : 'Confirmar lote'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={!todosVerificados || processando}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aprovar ({selecionados.length})
          </button>
        )}
      </div>
    </div>
  )
}

