'use client'

import { useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import ModalConteudo from '@/components/atividades/ModalConteudo'

/**
 * @param {{
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   donorUsername: string
 *   hrefInteractor: string
 *   hrefDonor: string
 *   texto: string
 *   postId: string
 * }} props
 */
export default function AtividadeCurtiuPost({
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  texto,
  postId,
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const verHref = `/perfil/atividades/${encodeURIComponent(postId)}`

  return (
    <>
      <div className="min-w-0">
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
              <Link href={hrefInteractor} className="font-medium text-[#0097b2] hover:underline">
                @{interactorUsername}
              </Link>{' '}
              curtiu post de{' '}
              <Link href={hrefDonor} className="font-medium text-[#0097b2] hover:underline">
                @{donorUsername}
              </Link>
              :
            </p>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="mt-1.5 block min-h-0 w-full text-left"
            >
              <p className="line-clamp-3 whitespace-pre-wrap text-base text-gray-800">
                {String(texto || '').trimEnd() || '—'}
              </p>
            </button>
          </div>
        </div>
      </div>
      <ModalConteudo aberto={modal} onFechar={() => setModal(false)} titulo="Post" verNoFeedHref={verHref}>
        <p className="whitespace-pre-wrap text-base text-gray-800">{texto || '—'}</p>
      </ModalConteudo>
    </>
  )
}
