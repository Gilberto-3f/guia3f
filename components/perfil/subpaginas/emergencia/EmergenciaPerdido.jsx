'use client'

import { BadgeCheck } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'

export default function EmergenciaPerdido() {
  const router = useRouter()

  return (
    <div className="px-1 pb-4">
      <p className="text-sm text-gray-600">
        Está perdido(a) na região? Abra o chat com a administração — sua localização será compartilhada em
        tempo real para facilitar o apoio.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => router.push('/chat-adm?motivo=perdido')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83a]"
        >
          <BadgeCheck className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
          Chamar ADM
        </button>
        <button
          type="button"
          onClick={() => {
            window.alert(
              'Contactar profissional — em breve: localizaremos um profissional de mobilidade para atendimento particular.',
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
