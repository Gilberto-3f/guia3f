'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Link, useRouter } from '@/i18n/navigation'
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
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
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
              <Link href={hrefInteractor} className="font-medium text-[#0097b2] hover:underline">
                @{interactorUsername}
              </Link>{' '}
              curtiu post de{' '}
              <Link href={hrefDonor} className="font-medium text-[#0097b2] hover:underline">
                @{donorUsername}
              </Link>
              :
            </p>
            <button type="button" onClick={() => setModal(true)} className="mt-2 w-full rounded-lg bg-gray-50 p-3 text-left">
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-gray-700">{texto || '—'}</p>
            </button>
          </div>
        </div>
      </div>
      <ModalConteudo aberto={modal} onFechar={() => setModal(false)} titulo="Post" verNoFeedHref={verHref}>
        <p className="whitespace-pre-wrap text-sm text-gray-800">{texto || '—'}</p>
      </ModalConteudo>
    </>
  )
}
