'use client'

/**
 * Área central do header do canal — toque abre o drawer de informações.
 * @param {{
 *   onAbrirDrawer: () => void
 *   disabled?: boolean
 *   children: import('react').ReactNode
 *   className?: string
 * }} props
 */
export default function CanalHeaderTitulo({ onAbrirDrawer, disabled = false, children, className = '' }) {
  const abrir = () => {
    if (!disabled) onAbrirDrawer()
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={disabled}
      className={`flex min-h-10 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center text-center text-white transition hover:bg-white/10 active:bg-white/15 disabled:cursor-default disabled:hover:bg-transparent ${className}`}
      aria-label="Informações do canal"
    >
      {children}
    </button>
  )
}
