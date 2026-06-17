'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import { AVISO_PLANO_EMPRESA_PADRAO } from '@/lib/planosEmpresaServicosGate'

export default function AvisoPlanoEmpresaBloqueado({
  mensagem = AVISO_PLANO_EMPRESA_PADRAO,
  compact = false,
  className = '',
}: {
  mensagem?: string
  compact?: boolean
  className?: string
}) {
  if (compact) {
    return (
      <div
        className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center ${className}`.trim()}
      >
        <p className="text-xs leading-relaxed text-amber-900">{mensagem}</p>
        <Link
          href="/canal"
          className="mt-2 inline-block text-xs font-semibold text-[#0097b2] hover:underline"
        >
          Abrir canal Financeiro
        </Link>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 p-6 text-center sm:p-8 ${className}`.trim()}>
      <Crown className="mx-auto mb-3 h-8 w-8 text-amber-700" strokeWidth={2} aria-hidden />
      <p className="text-sm text-amber-900 sm:text-base">{mensagem}</p>
      <Link
        href="/canal"
        className="mt-4 inline-block rounded-full bg-[#0097b2] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
      >
        Abrir canal Financeiro
      </Link>
    </div>
  )
}
