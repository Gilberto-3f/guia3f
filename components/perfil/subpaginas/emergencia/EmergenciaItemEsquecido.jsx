'use client'

import { BadgeCheck } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'

export default function EmergenciaItemEsquecido() {
  const router = useRouter()

  return (
    <div className="px-1 pb-4">
      <p className="text-sm text-gray-600">
        Esqueceu um pertence no veículo do profissional que lhe atendeu? Avise a administração pelo
        mensageiro — o ADM verá os últimos profissionais que o atenderam para facilitar o contato.
      </p>

      <p className="mt-3 text-sm text-gray-600">
        Em caso de deslocamento para devolução na sua localização, pode haver uma taxa a partir de R$25,00 a
        ser pago para o profissional.
      </p>

      <button
        type="button"
        onClick={() => router.push('/chat-adm?motivo=item-esquecido')}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83a]"
      >
        <BadgeCheck className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
        Chamar ADM
      </button>
    </div>
  )
}
