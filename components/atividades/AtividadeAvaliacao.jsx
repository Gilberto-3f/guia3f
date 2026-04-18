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
    <div className="block rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => router.push(`/perfil/${usuarioAtorId}`)}
          className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-gray-100"
        >
          <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="24px" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-snug text-gray-800">
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
          {feedback ? <p className="mt-1 line-clamp-3 text-[10px] text-gray-500">{feedback}</p> : null}
        </div>
      </div>
    </div>
  )
}
