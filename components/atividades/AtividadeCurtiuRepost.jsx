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
      <div className="rounded-lg border border-gray-100 bg-white px-2 py-2 shadow-sm sm:px-3">
        <div className="grid min-w-0 grid-cols-[2rem_1fr] items-start gap-x-2">
          <button
            type="button"
            onClick={() => router.push(hrefInteractor)}
            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
          >
            <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="32px" />
          </button>
          <div className="min-w-0">
            <p className="text-xs leading-snug text-gray-800 sm:text-sm">
              <Link href={hrefInteractor} className="font-medium text-[#0097b2] hover:underline">
                @{interactorUsername}
              </Link>{' '}
              curtiu conteúdo repostado por{' '}
              <Link href={hrefDonor} className="font-medium text-[#0097b2] hover:underline">
                @{donorUsername}
              </Link>
            </p>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="mt-1.5 block min-h-0 w-full rounded-md bg-gray-50 px-2 py-2 text-left"
            >
              {previewTipo === 'foto' && previewUrl ? (
                <div className="relative mx-auto h-24 w-full max-w-[7rem] overflow-hidden rounded-md bg-gray-100 sm:h-28 sm:max-w-[7.5rem]">
                  <Image src={previewUrl} alt="" fill className="object-cover" sizes="120px" />
                </div>
              ) : (
                <p className="line-clamp-3 whitespace-pre-wrap text-xs text-gray-700 sm:text-sm">
                  {String(previewTexto || '').trimEnd() || '—'}
                </p>
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
