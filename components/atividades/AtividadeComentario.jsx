'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import ModalConteudo from '@/components/atividades/ModalConteudo'

/**
 * @param {{
 *   usernameAtor: string
 *   interactorFoto: string | null
 *   usernameDono: string
 *   hrefInteractor: string
 *   hrefDono: string
 *   emFoto: boolean
 *   textoComentario: string
 *   postId: string
 *   comentarioId?: string | null
 * }} props
 */
export default function AtividadeComentario({
  usernameAtor,
  interactorFoto,
  usernameDono,
  hrefInteractor,
  hrefDono,
  emFoto,
  textoComentario,
  postId,
  comentarioId = null,
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const verHref =
    comentarioId != null && comentarioId !== ''
      ? `/perfil/atividades/${encodeURIComponent(postId)}?comentario=${encodeURIComponent(comentarioId)}`
      : `/perfil/atividades/${encodeURIComponent(postId)}`

  return (
    <>
      <div className="block rounded-lg border border-gray-100 bg-white px-2 py-2 shadow-sm transition hover:border-gray-200 sm:px-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => router.push(hrefInteractor)}
            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
          >
            <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="32px" />
          </button>
          <div className="min-w-0 flex-1 self-start">
            <p className="text-xs leading-snug text-gray-800 sm:text-sm">
              <button type="button" onClick={() => router.push(hrefInteractor)} className="font-medium text-[#0097b2] hover:underline">
                @{usernameAtor}
              </button>{' '}
              comentou {emFoto ? 'foto' : 'post'} de{' '}
              <button type="button" onClick={() => router.push(hrefDono)} className="font-medium text-[#0097b2] hover:underline">
                @{usernameDono}
              </button>
              :
            </p>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="mt-1.5 min-h-0 w-full rounded-md bg-gray-50 px-2 py-2 text-left"
            >
              <p className="line-clamp-3 text-xs italic text-gray-600 sm:text-sm">&ldquo;{textoComentario}&rdquo;</p>
            </button>
          </div>
        </div>
      </div>
      <ModalConteudo aberto={modal} onFechar={() => setModal(false)} titulo="Comentário" verNoFeedHref={verHref}>
        <p className="whitespace-pre-wrap text-sm text-gray-800">&ldquo;{textoComentario}&rdquo;</p>
      </ModalConteudo>
    </>
  )
}
