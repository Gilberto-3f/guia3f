'use client'

import { useState } from 'react'

export default function EmergenciaItemEsquecido() {
  const [descricao, setDescricao] = useState('')

  return (
    <div className="px-1 pb-4">
      <h1 className="text-lg font-bold text-gray-900">Esqueceu um item?</h1>

      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        rows={5}
        placeholder="Descreva o item perdido na pousada em que se hospedou ou no veículo do profissional que lhe atendeu…"
        className="mt-4 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0097b2] focus:ring-1 focus:ring-[#0097b2]"
      />

      <p className="mt-3 text-sm text-gray-600">
        Em caso de deslocamento para devolução na sua localização, pode haver uma taxa a partir de R$25,00 a ser pago
        para o profissional.
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
