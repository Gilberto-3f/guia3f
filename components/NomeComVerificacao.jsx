'use client'

import CheckVerificado from '@/components/CheckVerificado'

/**
 * Nome social com selo à frente quando verificado.
 * @param {{ nome: string, verificado?: boolean, verificadoTipo?: 'profissional' | 'empresa', className?: string, nomeClassName?: string }} props
 */
export default function NomeComVerificacao({
  nome,
  verificado = false,
  verificadoTipo = 'profissional',
  className = 'inline-flex min-w-0 max-w-full items-center gap-1',
  nomeClassName = 'min-w-0 truncate',
}) {
  return (
    <span className={className}>
      {verificado ? <CheckVerificado variant={verificadoTipo} /> : null}
      <span className={nomeClassName}>{nome}</span>
    </span>
  )
}
