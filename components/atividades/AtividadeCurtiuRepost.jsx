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
 *   tempoInteracao?: string
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
  tempoInteracao = '',
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const verHref = `/perfil/atividades/${encodeURIComponent(postId)}`

  return (
    <>
      <div className="min-w-0">
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
              className="mt-1.5 block min-h-0 w-full text-left"
            >
              {previewTipo === 'foto' && previewUrl ? (
                <div className="relative mx-auto h-24 w-full max-w-[7rem] overflow-hidden rounded-md bg-gray-100 sm:h-28 sm:max-w-[7.5rem]">
                  <Image src={previewUrl} alt="" fill className="object-cover" sizes="120px" />
                </div>
              ) : (
                <p className="line-clamp-3 whitespace-pre-wrap text-base text-gray-800">
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
