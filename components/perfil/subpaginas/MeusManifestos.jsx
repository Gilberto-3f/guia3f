'use client'

import { useRouter } from '@/i18n/navigation'

/** Redireciona para a página Manifesto (não drawer). */
export default function MeusManifestos() {
  const router = useRouter()

  return (
    <div className="space-y-3 px-1">
      <p className="text-sm text-gray-600">
        O manifesto agora abre em página dedicada com a lista de turistas contratados e dados de atendimento.
      </p>
      <button
        type="button"
        onClick={() => router.push('/profissional/manifesto')}
        className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#007d94]"
      >
        Abrir Manifesto
      </button>
    </div>
  )
}
