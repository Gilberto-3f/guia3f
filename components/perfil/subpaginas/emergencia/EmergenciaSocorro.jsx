'use client'

import { BadgeCheck } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { EMERGENCIA_ADUANAS } from '@/lib/emergenciaTurista'

export default function EmergenciaSocorro() {
  const router = useRouter()

  return (
    <div className="px-1 pb-4">
      <p className="text-sm text-gray-600">Situação de risco — acione a administração ou serviços de emergência.</p>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => router.push('/chat-adm?motivo=socorro')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#00b83a]"
        >
          <BadgeCheck className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
          CHAMAR ADM
        </button>
        <button
          type="button"
          onClick={() => {
            window.alert(
              'Contactar profissional — em breve: tentaremos localizar o profissional mais próximo para auxiliar.',
            )
          }}
          className="w-full rounded-xl bg-[#0097b2] py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#007d94]"
        >
          Contactar profissional
        </button>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Emergência policial</p>
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
              className="rounded-xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-red-700"
            >
              {aduana.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
