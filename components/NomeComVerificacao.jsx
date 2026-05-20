'use client'

import CheckVerificado from '@/components/CheckVerificado'

/**
 * Nome social com selo verde à frente quando verificado.
 * @param {{ nome: string, verificado?: boolean, className?: string, nomeClassName?: string }} props
 */
export default function NomeComVerificacao({
  nome,
  verificado = false,
  className = 'inline-flex min-w-0 max-w-full items-center gap-1',
  nomeClassName = 'min-w-0 truncate',
}) {
  return (
    <span className={className}>
      {verificado ? <CheckVerificado className="h-4 w-4" /> : null}
      <span className={nomeClassName}>{nome}</span>
    </span>
  )
}
