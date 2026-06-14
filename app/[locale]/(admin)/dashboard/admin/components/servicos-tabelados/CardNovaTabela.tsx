'use client'

import { useState } from 'react'

export function CardNovaTabela({
  pontoPartida,
  salvando,
  onConfirmar,
  onCancelar,
}: {
  pontoPartida: string
  salvando: boolean
  onConfirmar: (destino: string, valor: number) => Promise<{ success: boolean; error?: unknown }>
  onCancelar: () => void
}) {
  const [destino, setDestino] = useState('')
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const confirmar = async () => {
    setErro(null)
    const valorNum = Number(valor)
    if (!destino.trim()) {
      setErro('Informe o destino final.')
      return
    }
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      setErro('Informe o valor da rota.')
      return
    }
    const res = await onConfirmar(destino.trim(), valorNum)
    if (!res.success) {
      const msg =
        res.error instanceof Error
          ? res.error.message
          : typeof res.error === 'object' && res.error && 'message' in res.error
            ? String((res.error as { message: string }).message)
            : 'Não foi possível salvar.'
      setErro(msg)
    }
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[#0097b2]">Nova Tabela</h3>

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Ponto de Partida
          <input
            type="text"
            readOnly
            value={pontoPartida}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Destino Final
          <input
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value.slice(0, 200))}
            placeholder="Para onde vai a rota?"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Valor da Rota
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
              R$
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-2 text-sm outline-none focus:border-[#0097b2]"
            />
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Apenas deslocamento do trajeto. Tickets negociados à parte nos botões dinâmicos.
          </p>
        </label>
      </div>

      {erro ? <p className="mt-3 text-sm text-rose-600">{erro}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          disabled={salvando}
          className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={salvando}
          className="flex-1 rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Confirmar'}
        </button>
      </div>
    </article>
  )
}
