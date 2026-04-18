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
    <div className="flex gap-1.5 rounded-lg border border-gray-100 bg-white px-2 py-1.5 text-[11px] text-gray-800 shadow-sm">
      <button
        type="button"
        className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-gray-100"
        onClick={() => router.push(`/perfil/${seguidorUsuarioId}`)}
      >
        <AvatarImage src={seguidorFoto} alt="" fill className="object-cover" sizes="24px" />
      </button>
      <p className="min-w-0 flex-1 leading-snug">
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
