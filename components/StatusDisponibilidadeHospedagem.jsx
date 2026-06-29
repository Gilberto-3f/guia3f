'use client'

import ModoApresentacaoIcon from '@/components/ModoApresentacaoIcon'
import {
  corDisponibilidadeHospedagem,
  normalizarDisponibilidadeHospedagem,
  rotuloDisponibilidadeHospedagem,
} from '@/lib/hospedagemDisponibilidade'

/**
 * Badge de disponibilidade de quartos (Hospedagem).
 * @param {{ disponibilidade?: string | null, className?: string }} props
 */
export default function StatusDisponibilidadeHospedagem({ disponibilidade, className = '' }) {
  const valor = normalizarDisponibilidadeHospedagem(disponibilidade) ?? 'livre'
  const cor = corDisponibilidadeHospedagem(valor)
  const rotulo = rotuloDisponibilidadeHospedagem(valor)

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <ModoApresentacaoIcon iconeKey="anfitriao" className="h-5 w-5 shrink-0" style={{ color: cor }} />
      <span className="text-sm font-bold tracking-wide" style={{ color: cor }}>
        {rotulo}
      </span>
    </div>
  )
}
