'use client'

/** Bolinha vermelha — novas verificações de cadastro pendentes (todos os ADMs). */
export function CadastroVerificacaoBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={`inline-flex min-h-[14px] min-w-[14px] max-w-[2rem] shrink-0 items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[9px] font-bold leading-none text-white tabular-nums ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/** Bolinha preta — solicitações de exclusão pendentes (somente ADM GERAL). */
export function CadastroExclusaoBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={`inline-flex min-h-[14px] min-w-[14px] max-w-[2rem] shrink-0 items-center justify-center rounded-full bg-gray-900 px-0.5 text-[9px] font-bold leading-none text-white tabular-nums ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function CadastroBadgesPar({
  verificacoes,
  exclusoes,
  mostrarExclusao = false,
  className = '',
}: {
  verificacoes: number
  exclusoes: number
  mostrarExclusao?: boolean
  className?: string
}) {
  if (verificacoes <= 0 && (!mostrarExclusao || exclusoes <= 0)) return null
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <CadastroVerificacaoBadge count={verificacoes} />
      {mostrarExclusao ? <CadastroExclusaoBadge count={exclusoes} /> : null}
    </span>
  )
}
