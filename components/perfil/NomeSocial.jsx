'use client'

import { ShieldCheck } from 'lucide-react'

/**
 * @param {{
 *   nome: string
 *   mostrarCartao?: boolean
 *   profissionalVerificado?: boolean
 *   onAbrirCartao?: () => void
 * }} props
 * profissionalVerificado: true quando status aprovado (escudo verde); senão escudo vermelho com ?.
 */
export default function NomeSocial({
  nome,
  mostrarCartao = false,
  profissionalVerificado = false,
  onAbrirCartao,
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {mostrarCartao ? (
        profissionalVerificado ? (
          <button
            type="button"
            onClick={() => onAbrirCartao?.()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: '#00D443' }}
            aria-label="Abrir cartão de visita — profissional verificado"
            title="Cartão de visita"
          >
            <ShieldCheck size={18} className="text-white" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAbrirCartao?.()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F44336] text-[15px] font-bold leading-none text-white"
            aria-label="Abrir cartão de visita — perfil em análise"
            title="Cartão de visita — em análise"
          >
            <span aria-hidden>?</span>
          </button>
        )
      ) : null}
      <h1 className="min-w-0 truncate text-left text-2xl font-bold text-[#001f3f]">{nome}</h1>
    </div>
  )
}
