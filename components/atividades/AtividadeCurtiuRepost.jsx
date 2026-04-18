'use client'

import { useState } from 'react'
import Image from 'next/image'
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
 *   postId: string
 *   previewTipo: 'foto' | 'texto'
 *   previewUrl: string | null
 *   previewTexto: string
 *   modalChildren: import('react').ReactNode
 * }} props
 */
export default function AtividadeCurtiuRepost({
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  postId,
  previewTipo,
  previewUrl,
  previewTexto,
  modalChildren,
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const verHref = `/perfil/atividades/${encodeURIComponent(postId)}`

  return (
    <>
      <div className="rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
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
              <Link href={hrefInteractor} className="font-medium text-[#0097b2] hover:underline">
                @{interactorUsername}
              </Link>{' '}
              curtiu conteúdo repostado por{' '}
              <Link href={hrefDonor} className="font-medium text-[#0097b2] hover:underline">
                @{donorUsername}
              </Link>
            </p>
            <button type="button" onClick={() => setModal(true)} className="mt-1 w-full rounded-md bg-gray-50 px-1.5 py-1.5 text-left">
              {previewTipo === 'foto' && previewUrl ? (
                <div className="relative mx-auto h-20 w-full max-w-[6rem] overflow-hidden rounded-md bg-gray-100 sm:h-24 sm:max-w-[6.5rem]">
                  <Image src={previewUrl} alt="" fill className="object-cover" sizes="104px" />
                </div>
              ) : (
                <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-gray-700">{previewTexto || '—'}</p>
              )}
            </button>
          </div>
        </div>
      </div>
      <ModalConteudo aberto={modal} onFechar={() => setModal(false)} titulo="Repostagem" verNoFeedHref={verHref}>
        {modalChildren}
      </ModalConteudo>
    </>
  )
}
