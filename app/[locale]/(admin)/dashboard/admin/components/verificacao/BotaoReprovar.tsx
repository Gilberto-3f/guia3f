'use client'

import { useState } from 'react'

export function BotaoReprovar({ onConfirm }: { onConfirm: (motivo: string) => void }) {
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
      >
        Reprovar
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-2">
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo obrigatório"
        className="mb-2 w-44 rounded border border-rose-200 bg-white p-1 text-xs"
      />
      <div className="flex items-center justify-end gap-1">
        <button type="button" onClick={() => setOpen(false)} className="rounded bg-gray-200 px-2 py-1 text-xs font-semibold">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!motivo.trim()}
          onClick={() => onConfirm(motivo.trim())}
          className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirmar
        </button>
      </div>
    </div>
  )
}

