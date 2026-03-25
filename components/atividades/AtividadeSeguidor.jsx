'use client'

import Link from 'next/link'

/**
 * @param {{
 *   usernameSeguidor: string
 *   usernameSeguido: string
 *   seguidoUsuarioId: string
 *   seguidoTipo: string
 *   empresaId: string | null
 * }} props
 */
export default function AtividadeSeguidor({ usernameSeguidor, usernameSeguido, seguidoUsuarioId, seguidoTipo, empresaId }) {
  const hrefAlvo =
    seguidoTipo === 'empresa' && empresaId ? `/empresa/${empresaId}` : `/perfil/${seguidoUsuarioId}`

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-800 shadow-sm">
      <span className="mr-1" aria-hidden>
        👤
      </span>
      <span className="font-medium text-gray-700">@{usernameSeguidor}</span> começou a seguir{' '}
      <Link href={hrefAlvo} className="font-medium text-[#0097b2]">
        @{usernameSeguido}
      </Link>
    </div>
  )
}
