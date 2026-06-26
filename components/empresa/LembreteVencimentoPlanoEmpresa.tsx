'use client'

import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

export default function LembreteVencimentoPlanoEmpresa({
  diasParaVencimento,
  className = '',
}: {
  diasParaVencimento: number | null
  className?: string
}) {
  if (diasParaVencimento == null || diasParaVencimento < 0 || diasParaVencimento > 5) return null

  const texto =
    diasParaVencimento === 0
      ? 'Seu plano vence hoje. Renove pelo canal Financeiro para manter os serviços ativos.'
      : diasParaVencimento === 1
        ? 'Seu plano vence amanhã. Renove pelo canal Financeiro para evitar interrupção.'
        : `Seu plano vence em ${diasParaVencimento} dias. Renove pelo canal Financeiro para manter os serviços.`

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 ${className}`.trim()}
      role="status"
    >
      <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-950">{texto}</p>
        <Link href="/canal" className="mt-1 inline-block text-xs font-semibold text-[#0097b2] hover:underline">
          Abrir canal Financeiro
        </Link>
      </div>
    </div>
  )
}
