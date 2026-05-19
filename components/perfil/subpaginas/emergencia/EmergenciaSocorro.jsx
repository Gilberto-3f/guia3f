'use client'

import { useState } from 'react'
import EmergenciaMensageiroAdm from './EmergenciaMensageiroAdm'

const TEL_EMERGENCIA = 'tel:190'

export default function EmergenciaSocorro() {
  const [modo, setModo] = useState(/** @type {'menu' | 'adm'} */ ('menu'))

  if (modo === 'adm') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setModo('menu')}
          className="mb-2 text-sm font-medium text-[#0097b2] hover:underline"
        >
          ← Voltar
        </button>
        <EmergenciaMensageiroAdm
          titulo="SOCORRO"
          subtitulo="Situação de risco — descreva o ocorrido. A equipe ADM irá orientá-lo. Em perigo imediato, use também o serviço de emergência local."
          incluirLocalizacao
          placeholder="Descreva a situação de risco…"
        />
      </div>
    )
  }

  return (
    <div className="px-1 pb-4">
      <h1 className="text-lg font-bold text-gray-900">SOCORRO</h1>
      <p className="mt-1 text-sm text-amber-800">
        ⚠️ Em risco real, ligue também para o serviço de emergência da sua cidade (ex.: 190 polícia, 192 SAMU, 193
        bombeiros).
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setModo('adm')}
          className="w-full rounded-xl bg-[#16a34a] py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#15803d]"
        >
          Chamar ADM
        </button>
        <a
          href={TEL_EMERGENCIA}
          className="flex w-full items-center justify-center rounded-xl bg-red-600 py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-700"
        >
          Serviço de emergência
        </a>
        <button
          type="button"
          onClick={() => {
            window.alert(
              'Contactar profissional — em breve: tentaremos localizar o profissional mais próximo para auxiliar.'
            )
          }}
          className="w-full rounded-xl border-2 border-[#2563eb] bg-white py-3.5 text-sm font-bold uppercase tracking-wide text-[#2563eb] hover:bg-blue-50"
        >
          Contactar profissional
        </button>
      </div>
    </div>
  )
}
