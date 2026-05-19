'use client'

import { useState } from 'react'

export default function EmergenciaItemEsquecido() {
  const [descricao, setDescricao] = useState('')

  return (
    <div className="px-1 pb-4">
      <h1 className="text-lg font-bold text-gray-900">Esqueceu um item no veículo ou pousada?</h1>
      <p className="mt-2 text-sm text-gray-600">
        Descreva o item perdido na pousada em que se hospedou ou no veículo do profissional que lhe atendeu.
      </p>

      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        rows={5}
        placeholder="Ex.: carteira preta deixada no banco traseiro do transfer…"
        className="mt-4 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0097b2] focus:ring-1 focus:ring-[#0097b2]"
      />

      <p className="mt-3 text-xs text-gray-500">
        Pode haver taxa a partir de <strong className="font-semibold text-gray-700">R$ 25,00</strong> caso haja
        deslocamento para devolução do item.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => window.alert('Contato com profissional — em breve.')}
          className="flex-1 rounded-xl bg-[#2563eb] py-3 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#1d4ed8]"
        >
          Profissional
        </button>
        <button
          type="button"
          onClick={() => window.alert('Chamada ao ADM — em breve.')}
          className="flex-1 rounded-xl bg-[#16a34a] py-3 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#15803d]"
        >
          Chamar ADM
        </button>
      </div>
    </div>
  )
}
