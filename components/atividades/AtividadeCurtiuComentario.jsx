'use client'

import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'

/**
 * @param {{
 *   usuarioAtorId: string
 *   usernameAtor: string
 *   textoComentario: string
 *   postId: string
 *   comentarioId: string
 * }} props
 */
export default function AtividadeCurtiuComentario({
  usuarioAtorId,
  usernameAtor,
  textoComentario,
  postId,
  comentarioId,
}) {
  const router = useRouter()
  const href = `/perfil/atividades/${encodeURIComponent(postId)}?comentario=${encodeURIComponent(comentarioId)}`

  return (
    <div className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200">
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
        curtiu um comentário:
      </p>
      <Link href={href} className="mt-2 block">
        <p className="line-clamp-3 text-sm italic text-gray-600">&ldquo;{textoComentario}&rdquo;</p>
      </Link>
    </div>
  )
}
