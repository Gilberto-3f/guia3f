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
 *   tempoInteracao?: string
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
  tempoInteracao = '',
}) {
  const router = useRouter()
  const hrefAlvo =
    seguidoTipo === 'empresa' && empresaId ? `/empresa/${empresaId}` : `/perfil/${seguidoUsuarioId}`

  return (
    <div className="grid min-w-0 grid-cols-[2.75rem_1fr] items-start gap-x-2 text-sm text-gray-800">
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
          onClick={() => router.push(`/perfil/${seguidorUsuarioId}`)}
        >
          <AvatarImage src={seguidorFoto} alt="" fill className="object-cover" sizes="32px" />
        </button>
        {tempoInteracao ? (
          <span className="max-w-[2.75rem] text-center text-[10px] leading-tight text-gray-500">{tempoInteracao}</span>
        ) : null}
      </div>
      <p className="min-w-0 pt-0.5 leading-snug">
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
