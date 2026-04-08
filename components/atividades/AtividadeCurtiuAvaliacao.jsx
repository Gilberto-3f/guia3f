'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from '@/i18n/navigation'
import ModalConteudo from '@/components/atividades/ModalConteudo'
import AvaliacaoCard from '@/components/AvaliacaoCard'

/**
 * @param {{
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   donorUsername: string
 *   hrefInteractor: string
 *   hrefDonor: string
 *   postId: string
 *   meta: Record<string, unknown> | null
 * }} props
 */
export default function AtividadeCurtiuAvaliacao({
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  postId,
  meta,
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const verHref = `/perfil/atividades/${encodeURIComponent(postId)}`
  const nota = meta && typeof meta.nota === 'number' ? meta.nota : Number(meta?.nota) || 0
  const feedback =
    meta && typeof meta.feedback === 'string'
      ? meta.feedback
      : meta && typeof meta.comentario === 'string'
        ? meta.comentario
        : ''
  const estrelas = '⭐'.repeat(Math.min(5, Math.max(1, Math.round(Number(nota)) || 1)))

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
              curtiu avaliação de{' '}
              <Link href={hrefDonor} className="font-medium text-[#0097b2] hover:underline">
                @{donorUsername}
              </Link>
            </p>
            <button type="button" onClick={() => setModal(true)} className="mt-2 w-full rounded-lg bg-gray-50 p-3 text-left">
              <p className="text-sm text-amber-600">{estrelas}</p>
              {feedback ? <p className="mt-1 line-clamp-3 text-sm text-gray-700">{feedback}</p> : null}
            </button>
          </div>
        </div>
      </div>
      <ModalConteudo aberto={modal} onFechar={() => setModal(false)} titulo="Avaliação" verNoFeedHref={verHref}>
        {meta && typeof meta === 'object' ? <AvaliacaoCard meta={meta} /> : <p className="text-sm text-gray-600">Sem detalhes.</p>}
      </ModalConteudo>
    </>
  )
}
