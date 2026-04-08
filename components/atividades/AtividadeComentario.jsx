'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from '@/i18n/navigation'
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
      <div className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-gray-200">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(hrefInteractor)}
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100"
          >
            {interactorFoto ? (
              <Image src={interactorFoto} alt="" fill className="object-cover" sizes="40px" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg text-gray-400" aria-hidden>
                👤
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-800">
              <button type="button" onClick={() => router.push(hrefInteractor)} className="font-medium text-[#0097b2] hover:underline">
                @{usernameAtor}
              </button>{' '}
              comentou {emFoto ? 'foto' : 'post'} de{' '}
              <button type="button" onClick={() => router.push(hrefDono)} className="font-medium text-[#0097b2] hover:underline">
                @{usernameDono}
              </button>
              :
            </p>
            <button type="button" onClick={() => setModal(true)} className="mt-2 w-full rounded-lg bg-gray-50 p-3 text-left">
              <p className="line-clamp-3 text-sm italic text-gray-600">&ldquo;{textoComentario}&rdquo;</p>
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
