'use client'

import Image from 'next/image'
import { useState } from 'react'
import { X } from 'lucide-react'
import EmergenciaMensageiroAdm from './EmergenciaMensageiroAdm'

/** Números de emergência policial — tríplice fronteira (ajustáveis conforme operação local). */
const POLICIA_FOZ = { href: 'tel:190', label: 'Polícia de Foz' }
const POLICIA_CDE = { href: 'tel:911', label: 'Polícia de CDE' }
const POLICIA_IGUAZU = { href: 'tel:101', label: 'Polícia de P. Iguazu' }

/**
 * @param {{ href: string, label: string, flagSrc: string, flagAlt: string }} props
 */
function BotaoPolicia({ href, label, flagSrc, flagAlt }) {
  return (
    <a
      href={href}
      className="flex w-full items-center gap-3 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
    >
      <span className="relative h-5 w-7 shrink-0 overflow-hidden rounded-sm shadow-sm ring-1 ring-white/30">
        <Image src={flagSrc} alt={flagAlt} fill className="object-cover" sizes="28px" />
      </span>
      <span className="flex-1 text-left uppercase tracking-wide">{label}</span>
    </a>
  )
}

export default function EmergenciaSocorro() {
  const [modo, setModo] = useState(/** @type {'menu' | 'adm'} */ ('menu'))

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
          titulo="SOCORRO"
          subtitulo="Situação de risco — descreva o ocorrido. A equipe ADM irá orientá-lo."
          incluirLocalizacao
          placeholder="Descreva a situação de risco…"
        />
      </div>
    )
  }

  return (
    <div className="px-1 pb-4">
      <h1 className="text-lg font-bold text-gray-900">SOCORRO</h1>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setModo('adm')}
          className="w-full rounded-xl bg-[#86efac] py-3.5 text-sm font-bold uppercase tracking-wide text-green-900 transition hover:bg-[#4ade80]"
        >
          Chamar ADM
        </button>
        <button
          type="button"
          onClick={() => {
            window.alert(
              'Contactar profissional — em breve: tentaremos localizar o profissional mais próximo para auxiliar.'
            )
          }}
          className="w-full rounded-xl bg-[#0097b2] py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#007d94]"
        >
          Contactar profissional
        </button>
      </div>

      <p className="mt-5 text-sm font-medium text-gray-800">
        Em caso de risco real, chame pelo <span className="font-bold">SERVIÇO DE EMERGÊNCIA</span> da cidade onde você
        está:
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <BotaoPolicia {...POLICIA_FOZ} flagSrc="/flags/br.svg" flagAlt="Brasil" />
        <BotaoPolicia {...POLICIA_CDE} flagSrc="/flags/py.svg" flagAlt="Paraguai" />
        <BotaoPolicia {...POLICIA_IGUAZU} flagSrc="/flags/ar.svg" flagAlt="Argentina" />
      </div>
    </div>
  )
}
