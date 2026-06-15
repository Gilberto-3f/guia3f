'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import EmergenciaMensageiroAdm from './EmergenciaMensageiroAdm'

export default function EmergenciaPerdido() {
  const [modo, setModo] = useState(/** @type {'menu' | 'adm' | 'profissional'} */ ('menu'))

  if (modo === 'adm') {
    return (
      <div>
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setModo('menu')}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-red-600 text-white shadow-sm transition hover:bg-red-700 active:bg-red-800"
            aria-label="Fechar"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        <EmergenciaMensageiroAdm
          titulo="Estou perdido(a)"
          subtitulo="Envie uma mensagem à equipe ADM com sua situação e localização para orientação."
          incluirLocalizacao
          placeholder="Descreva onde está e o que precisa de ajuda…"
        />
      </div>
    )
  }

  return (
    <div className="px-1 pb-4">
      <h1 className="text-lg font-bold text-gray-900">Estou perdido(a)</h1>
      <p className="mt-1 text-sm text-gray-600">Escolha como deseja receber ajuda:</p>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setModo('adm')}
          className="w-full rounded-xl bg-[#16a34a] py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#15803d]"
        >
          Chamar ADM
        </button>
        <button
          type="button"
          onClick={() => {
            window.alert(
              'Contactar profissional — em breve: localizaremos um profissional de mobilidade para atendimento particular.'
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
