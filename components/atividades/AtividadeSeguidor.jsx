'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'

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
    <div className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-800 shadow-sm">
      <button
        type="button"
        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100"
        onClick={() => router.push(`/perfil/${seguidorUsuarioId}`)}
      >
        {seguidorFoto ? (
          <Image src={seguidorFoto} alt="" fill className="object-cover" sizes="40px" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg text-gray-400" aria-hidden>
            👤
          </span>
        )}
      </button>
      <p className="min-w-0 flex-1 pt-1">
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
