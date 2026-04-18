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
 *   textoComentario: string
 *   postId: string
 *   comentarioId: string
 * }} props
 */
export default function AtividadeCurtiuComentario({
  usernameAtor,
  interactorFoto,
  usernameDono,
  hrefInteractor,
  hrefDono,
  textoComentario,
  postId,
  comentarioId,
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const verHref = `/perfil/atividades/${encodeURIComponent(postId)}?comentario=${encodeURIComponent(comentarioId)}`

  return (
    <>
      <div className="block rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-sm transition hover:border-gray-200">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => router.push(hrefInteractor)}
            className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-gray-100"
          >
            <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="24px" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] leading-snug text-gray-800">
              <button type="button" onClick={() => router.push(hrefInteractor)} className="font-medium text-[#0097b2] hover:underline">
                @{usernameAtor}
              </button>{' '}
              curtiu comentário de{' '}
              <button type="button" onClick={() => router.push(hrefDono)} className="font-medium text-[#0097b2] hover:underline">
                @{usernameDono}
              </button>
              :
            </p>
            <button type="button" onClick={() => setModal(true)} className="mt-1 w-full rounded-md bg-gray-50 px-1.5 py-1.5 text-left">
              <p className="line-clamp-3 text-[11px] italic text-gray-600">&ldquo;{textoComentario}&rdquo;</p>
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
