'use client'

import { useState } from 'react'

export function BotaoAprovar({ onConfirm }: { onConfirm: () => void }) {
  const [confirmar, setConfirmar] = useState(false)

  if (!confirmar) {
    return (
      <button
        type="button"
        onClick={() => setConfirmar(true)}
        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        Aprovar
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setConfirmar(false)} className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-semibold">
        Não
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        Sim
      </button>
    </div>
  )
}

