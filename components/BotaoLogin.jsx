'use client'

const VERDE = '#00D443'

/**
 * Botão principal de envio do formulário de login (estilo verde, largura total até max-w-80).
 */
export default function BotaoLogin({ disabled, loading, children, loadingLabel, className = '' }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`w-full max-w-72 rounded-full py-2.5 text-xs font-bold uppercase text-white transition-colors disabled:opacity-60 hover:bg-[#00b838] ${className}`}
      style={{ backgroundColor: VERDE }}
    >
      {loading ? loadingLabel : children}
    </button>
  )
}
