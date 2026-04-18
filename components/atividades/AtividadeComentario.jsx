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
      <div className="block min-w-0">
        <div className="grid min-w-0 grid-cols-[2rem_1fr] items-start gap-x-2">
          <button
            type="button"
            onClick={() => router.push(hrefInteractor)}
            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
          >
            <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="32px" />
          </button>
          <div className="min-w-0">
            <p className="text-sm leading-snug text-gray-800">
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
              className="mt-1.5 block min-h-0 w-full text-left"
            >
              <p className="line-clamp-3 text-sm italic text-gray-600">
                &ldquo;{String(textoComentario || '').trimEnd()}&rdquo;
              </p>
            </button>
          </div>
        </div>
      </div>
      <ModalConteudo aberto={modal} onFechar={() => setModal(false)} titulo="Comentário" verNoFeedHref={verHref}>
        <p className="whitespace-pre-wrap text-base text-gray-800">&ldquo;{textoComentario}&rdquo;</p>
      </ModalConteudo>
    </>
  )
}
