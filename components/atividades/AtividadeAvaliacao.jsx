'use client'

import Link from 'next/link'

/**
 * @param {{
 *   usernameAtor: string
 *   nomeEmpresa: string
 *   empresaId: string
 *   nota: number
 *   feedback: string | null
 * }} props
 */
export default function AtividadeAvaliacao({ usernameAtor, nomeEmpresa, empresaId, nota, feedback }) {
  const estrelas = '⭐'.repeat(Math.min(5, Math.max(1, Math.round(Number(nota)) || 1)))

  return (
    <Link
      href={`/empresa/${encodeURIComponent(empresaId)}`}
      className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200"
    >
      <p className="text-sm text-gray-800">
        <span className="mr-1" aria-hidden>
          👤
        </span>
        <span className="font-medium text-[#0097b2]">@{usernameAtor}</span> avaliou{' '}
        <span className="font-medium text-gray-700">{nomeEmpresa}</span> com {estrelas}
      </p>
      {feedback ? <p className="mt-2 line-clamp-3 text-sm text-gray-600">{feedback}</p> : null}
    </Link>
  )
}
