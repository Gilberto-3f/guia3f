'use client'

import { useRouter } from '@/i18n/navigation'

export default function EmergenciaPerdido() {
  const router = useRouter()

  return (
    <div className="px-1 pb-4">
      <h1 className="text-lg font-bold text-gray-900">Estou perdido(a)</h1>
      <p className="mt-1 text-sm text-gray-600">Escolha como deseja receber ajuda:</p>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => router.push('/chat-adm?urgente=1')}
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
