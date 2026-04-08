'use client'

import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'

/**
 * @param {{
 *   seguidorUsuarioId: string
 *   usernameSeguidor: string
 *   usernameSeguido: string
 *   seguidoUsuarioId: string
 *   seguidoTipo: string
 *   empresaId: string | null
 * }} props
 */
export default function AtividadeSeguidor({
  seguidorUsuarioId,
  usernameSeguidor,
  usernameSeguido,
  seguidoUsuarioId,
  seguidoTipo,
  empresaId,
}) {
  const router = useRouter()
  const hrefAlvo =
    seguidoTipo === 'empresa' && empresaId ? `/empresa/${empresaId}` : `/perfil/${seguidoUsuarioId}`

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-800 shadow-sm">
      <span className="mr-1" aria-hidden>
        👤
      </span>
      <button
        type="button"
        className="font-medium text-gray-700 hover:text-[#0097b2] hover:underline"
        onClick={() => router.push(`/perfil/${seguidorUsuarioId}`)}
      >
        @{usernameSeguidor}
      </button>{' '}
      começou a seguir{' '}
      <Link href={hrefAlvo} className="font-medium text-[#0097b2] hover:underline">
        @{usernameSeguido}
      </Link>
    </div>
  )
}
