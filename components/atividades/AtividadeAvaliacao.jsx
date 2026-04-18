'use client'

import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'

/**
 * @param {{
 *   usuarioAtorId: string
 *   usernameAtor: string
 *   interactorFoto: string | null
 *   nomeEmpresa: string
 *   empresaId: string
 *   nota: number
 *   feedback: string | null
 * }} props
 */
export default function AtividadeAvaliacao({
  usuarioAtorId,
  usernameAtor,
  interactorFoto,
  nomeEmpresa,
  empresaId,
  nota,
  feedback,
}) {
  const router = useRouter()
  const estrelas = '⭐'.repeat(Math.min(5, Math.max(1, Math.round(Number(nota)) || 1)))

  return (
    <div className="block rounded-lg border border-gray-100 bg-white px-2 py-2 shadow-sm sm:px-3">
      <div className="grid min-w-0 grid-cols-[2rem_1fr] items-start gap-x-2">
        <button
          type="button"
          onClick={() => router.push(`/perfil/${usuarioAtorId}`)}
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
        >
          <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="32px" />
        </button>
        <div className="min-w-0">
          <p className="text-xs leading-snug text-gray-800 sm:text-sm">
            <button
              type="button"
              className="font-medium text-[#0097b2] hover:underline"
              onClick={() => router.push(`/perfil/${usuarioAtorId}`)}
            >
              @{usernameAtor}
            </button>{' '}
            avaliou{' '}
            <Link href={`/empresa/${encodeURIComponent(empresaId)}`} className="font-medium text-gray-700 hover:text-[#0097b2]">
              {nomeEmpresa}
            </Link>{' '}
            com {estrelas}
          </p>
          {feedback ? (
            <p className="mt-1.5 line-clamp-3 text-xs text-gray-600 sm:text-sm">{String(feedback).trimEnd()}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
