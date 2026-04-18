'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import GridFotos from '@/components/atividades/GridFotos'
import ModalVisualizacao from '@/components/atividades/ModalVisualizacao'

/**
 * @param {{
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   donorUsername: string
 *   hrefInteractor: string
 *   hrefDonor: string
 *   urls: string[]
 *   postIds: string[]
 *   totalCurtidas?: number
 *   tempoInteracao?: string
 * }} props
 */
export default function AtividadeCurtidas({
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  urls,
  postIds,
  totalCurtidas,
  tempoInteracao = '',
}) {
  const router = useRouter()
  const [modal, setModal] = useState({ aberto: false, i: 0 })
  const n = totalCurtidas ?? urls.length
  if (n === 0) return null

  return (
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
            <button type="button" onClick={() => router.push(hrefInteractor)} className="font-medium text-[#0097b2] hover:underline">
              @{interactorUsername}
            </button>{' '}
            curtiu {n === 1 ? 'foto' : `${n} fotos`} de{' '}
            <button type="button" onClick={() => router.push(hrefDonor)} className="font-medium text-[#0097b2] hover:underline">
              @{donorUsername}
            </button>
          </p>
          <div className="mt-2">
            <GridFotos urls={urls} max={10} onClickFoto={(i) => setModal({ aberto: true, i })} />
          </div>
          <button
            type="button"
            onClick={() => setModal({ aberto: true, i: 0 })}
            className="mt-2 text-sm font-medium text-[#0097b2]"
          >
            {n === 1 ? 'VER FOTO' : `VER TODAS AS ${n} FOTOS`}
          </button>
        </div>
      </div>
      <ModalVisualizacao
        aberto={modal.aberto}
        onFechar={() => setModal((m) => ({ ...m, aberto: false }))}
        postIds={postIds}
        indiceInicial={modal.i}
      />
    </div>
  )
}
