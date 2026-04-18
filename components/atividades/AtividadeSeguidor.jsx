'use client'

import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'

/**
 * @param {{
 *   seguidorUsuarioId: string
 *   usernameSeguidor: string
 *   seguidorFoto: string | null
 *   usernameSeguido: string
 *   seguidoUsuarioId: string
 *   seguidoTipo: string
 *   empresaId: string | null
 * }} props
 */
export default function AtividadeSeguidor({
  seguidorUsuarioId,
  usernameSeguidor,
  seguidorFoto,
  usernameSeguido,
  seguidoUsuarioId,
  seguidoTipo,
  empresaId,
}) {
  const router = useRouter()
  const hrefAlvo =
    seguidoTipo === 'empresa' && empresaId ? `/empresa/${empresaId}` : `/perfil/${seguidoUsuarioId}`

  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white px-2 py-2 text-xs text-gray-800 shadow-sm sm:px-3 sm:text-sm">
      <button
        type="button"
        className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
        onClick={() => router.push(`/perfil/${seguidorUsuarioId}`)}
      >
        <AvatarImage src={seguidorFoto} alt="" fill className="object-cover" sizes="32px" />
      </button>
      <p className="min-w-0 flex-1 pt-0.5 leading-snug">
        <button
          type="button"
          className="font-medium text-[#0097b2] hover:underline"
          onClick={() => router.push(`/perfil/${seguidorUsuarioId}`)}
        >
          @{usernameSeguidor}
        </button>{' '}
        começou a seguir{' '}
        <Link href={hrefAlvo} className="font-medium text-[#0097b2] hover:underline">
          @{usernameSeguido}
        </Link>
      </p>
    </div>
  )
}
