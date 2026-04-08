'use client'

import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'

/**
 * @param {{
 *   usuarioAtorId: string
 *   usernameAtor: string
 *   nomeEmpresa: string
 *   empresaId: string
 *   nota: number
 *   feedback: string | null
 * }} props
 */
export default function AtividadeAvaliacao({
  usuarioAtorId,
  usernameAtor,
  nomeEmpresa,
  empresaId,
  nota,
  feedback,
}) {
  const router = useRouter()
  const estrelas = '⭐'.repeat(Math.min(5, Math.max(1, Math.round(Number(nota)) || 1)))

  return (
    <div className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-800">
        <span className="mr-1" aria-hidden>
          👤
        </span>
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
      {feedback ? <p className="mt-2 line-clamp-3 text-sm text-gray-600">{feedback}</p> : null}
    </div>
  )
}
