'use client'

import Link from 'next/link'

/**
 * @param {{
 *   usernameAtor: string
 *   textoComentario: string
 *   postId: string
 *   comentarioId?: string | null
 * }} props
 */
export default function AtividadeComentario({ usernameAtor, textoComentario, postId, comentarioId = null }) {
  const href =
    comentarioId != null && comentarioId !== ''
      ? `/perfil/atividades/${encodeURIComponent(postId)}?comentario=${encodeURIComponent(comentarioId)}`
      : `/perfil/atividades/${encodeURIComponent(postId)}`

  return (
    <Link
      href={href}
      className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200"
    >
      <p className="text-sm text-gray-800">
        <span className="mr-1" aria-hidden>
          👤
        </span>
        <span className="font-medium text-[#0097b2]">@{usernameAtor}</span> comentou:
      </p>
      <p className="mt-2 line-clamp-3 text-sm italic text-gray-600">&ldquo;{textoComentario}&rdquo;</p>
    </Link>
  )
}
