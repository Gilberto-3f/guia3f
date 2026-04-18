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
              curtiu avaliação de{' '}
              <Link href={hrefDonor} className="font-medium text-[#0097b2] hover:underline">
                @{donorUsername}
              </Link>
            </p>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="mt-1.5 block min-h-0 w-full rounded-md bg-gray-50 px-2 py-2 text-left"
            >
              <p className="text-xs text-amber-600 sm:text-sm">{estrelas}</p>
              {feedback ? (
                <p className="mt-1 line-clamp-3 text-xs text-gray-700 sm:text-sm">{String(feedback).trimEnd()}</p>
              ) : null}
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
