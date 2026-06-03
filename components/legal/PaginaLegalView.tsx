'use client'

import { Link } from '@/i18n/navigation'
import GuiaAuthShell from '@/components/GuiaAuthShell'

export function PaginaLegalView({
  titulo,
  texto,
}: {
  titulo: string
  texto: string
}) {
  return (
    <GuiaAuthShell largeHeaderLogo>
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/escolha-perfil"
          className="mb-4 inline-block text-sm font-medium text-[#0097b2] hover:underline"
        >
          ← Voltar
        </Link>
        <h1 className="mb-4 text-xl font-bold text-[#0097b2] sm:text-2xl">{titulo}</h1>
        <div className="whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-[#001f3f]">
          {texto}
        </div>
      </div>
    </GuiaAuthShell>
  )
}
