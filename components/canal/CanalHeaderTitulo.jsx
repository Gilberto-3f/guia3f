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
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onAbrirDrawer()
      }}
      disabled={disabled}
      className={`flex min-w-0 flex-1 flex-col items-center justify-center text-center text-white transition hover:bg-white/10 disabled:cursor-default disabled:hover:bg-transparent ${className}`}
      aria-label="Informações do canal"
    >
      {children}
    </button>
  )
}
