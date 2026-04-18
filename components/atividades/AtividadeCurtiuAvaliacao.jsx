'use client'

import { useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
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
              curtiu avaliação de{' '}
              <Link href={hrefDonor} className="font-medium text-[#0097b2] hover:underline">
                @{donorUsername}
              </Link>
            </p>
            <button type="button" onClick={() => setModal(true)} className="mt-1 w-full rounded-md bg-gray-50 px-1.5 py-1.5 text-left">
              <p className="text-[11px] text-amber-600">{estrelas}</p>
              {feedback ? <p className="mt-0.5 line-clamp-3 text-[10px] text-gray-600">{feedback}</p> : null}
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
