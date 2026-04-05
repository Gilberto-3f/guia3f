'use client'

import Link from 'next/link'

/**
 * @param {{
 *   usernameAtor: string
 *   textoComentario: string
 *   postId: string
 *   comentarioId: string
 * }} props
 */
export default function AtividadeCurtiuComentario({ usernameAtor, textoComentario, postId, comentarioId }) {
  const href = `/atividades/${encodeURIComponent(postId)}?comentario=${encodeURIComponent(comentarioId)}`

  return (
    <Link
      href={href}
      className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200"
    >
      <p className="text-sm text-gray-800">
        <span className="mr-1" aria-hidden>
          👤
        </span>
        <span className="font-medium text-[#0097b2]">@{usernameAtor}</span> curtiu um comentário:
      </p>
      <p className="mt-2 line-clamp-3 text-sm italic text-gray-600">&ldquo;{textoComentario}&rdquo;</p>
    </Link>
  )
}
