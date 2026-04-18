'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import ModalVisualizacao from '@/components/atividades/ModalVisualizacao'

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
 *   tempoInteracao?: string
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
  tempoInteracao = '',
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)

  return (
    <>
      <div className="block min-w-0">
        <div className="grid min-w-0 grid-cols-[2.75rem_1fr] items-start gap-x-2">
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => router.push(hrefInteractor)}
              className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
            >
              <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="32px" />
            </button>
            {tempoInteracao ? (
              <span className="max-w-[2.75rem] text-center text-[10px] leading-tight text-gray-500">{tempoInteracao}</span>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-snug text-gray-800">
              <button type="button" onClick={() => router.push(hrefInteractor)} className="font-medium text-[#0097b2] hover:underline">
                @{usernameAtor}
              </button>{' '}
              curtiu comentário de{' '}
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
      <ModalVisualizacao
        aberto={modal}
        onFechar={() => setModal(false)}
        postIds={[postId]}
        comentarioId={comentarioId}
        interacaoUsuario={usernameAtor}
        interacaoResumo={`curtiu comentário de @${usernameDono}`}
      />
    </>
  )
}
