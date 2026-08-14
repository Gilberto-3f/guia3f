'use client'

import { EMERGENCIA_ADUANAS } from '@/lib/emergenciaTurista'

export default function EmergenciaSocorro() {
  return (
    <div className="px-1 pb-4">
      <p className="text-sm text-gray-600">Situação de risco — acione os serviços de emergência locais.</p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Polícia Local</p>
        <div className="flex flex-col gap-2">
          <a href="tel:190" className="rounded-xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-red-700">
            Polícia — Foz (190)
          </a>
          <a href="tel:911" className="rounded-xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-red-700">
            Polícia — CDE (911)
          </a>
          <a href="tel:101" className="rounded-xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-red-700">
            Polícia — P. Iguazu (101)
          </a>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Polícia aduaneira</p>
        <div className="flex flex-col gap-2">
          {EMERGENCIA_ADUANAS.map((aduana) => (
            <a
              key={aduana.label}
              href={aduana.tel ? `tel:${aduana.tel}` : undefined}
              onClick={
                aduana.tel
                  ? undefined
                  : (e) => {
                      e.preventDefault()
                      window.alert(`Contato de ${aduana.label} — em breve.`)
                    }
              }
              className="rounded-xl bg-amber-400 px-4 py-3.5 text-sm font-bold text-gray-900 hover:bg-amber-500"
            >
              {aduana.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
