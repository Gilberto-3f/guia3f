'use client'

import CheckVerificado from '@/components/CheckVerificado'

/**
 * @username com selo verde (feed, atividades, comentários).
 * @param {{
 *   username: string
 *   verificado?: boolean
 *   className?: string
 *   onClick?: () => void
 *   asButton?: boolean
 * }} props
 */
export default function UsuarioHandleVerificado({
  username,
  verificado = false,
  className = 'font-medium text-[#0097b2] hover:underline',
  onClick,
  asButton = true,
}) {
  const handle = `@${String(username ?? '').replace(/^@+/, '') || 'usuario'}`
  const inner = (
    <>
      {verificado ? <CheckVerificado /> : null}
      <span className="min-w-0 truncate">{handle}</span>
    </>
  )

  if (asButton && onClick) {
    return (
      <span className="inline-flex max-w-full items-center gap-0.5 align-middle">
        <button type="button" onClick={onClick} className={`inline-flex min-w-0 items-center gap-0.5 ${className}`}>
          {inner}
        </button>
      </span>
    )
  }

  return <span className={`inline-flex min-w-0 max-w-full items-center gap-0.5 align-middle ${className}`}>{inner}</span>
}
