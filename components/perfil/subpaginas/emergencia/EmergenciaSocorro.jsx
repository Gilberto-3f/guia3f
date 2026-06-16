'use client'

import { useRouter } from '@/i18n/navigation'

export default function EmergenciaSocorro() {
  const router = useRouter()

  return (
    <div className="px-1 pb-4">
      <h1 className="text-lg font-bold text-gray-900">SOCORRO</h1>
      <p className="mt-1 text-sm text-gray-600">Situação de risco — acione a administração ou serviços de emergência.</p>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => router.push('/chat-adm?urgente=1')}
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
    </div>
  )
}
