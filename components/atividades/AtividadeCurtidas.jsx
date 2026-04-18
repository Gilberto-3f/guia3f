'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import GridFotos from '@/components/atividades/GridFotos'
import ModalFotos from '@/components/atividades/ModalFotos'

/**
 * @param {{
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   donorUsername: string
 *   hrefInteractor: string
 *   hrefDonor: string
 *   urls: string[]
 *   totalCurtidas?: number
 * }} props
 */
export default function AtividadeCurtidas({
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  urls,
  totalCurtidas,
}) {
  const router = useRouter()
  const [modal, setModal] = useState({ aberto: false, i: 0 })
  const n = totalCurtidas ?? urls.length
  if (n === 0) return null

  return (
    <div className="rounded-lg border border-gray-100 bg-white px-2 py-2 shadow-sm sm:px-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.push(hrefInteractor)}
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
        >
          <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="32px" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-snug text-gray-800 sm:text-sm">
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
            className="mt-2 text-xs font-medium text-[#0097b2] sm:text-sm"
          >
            {n === 1 ? 'VER FOTO' : `VER TODAS AS ${n} FOTOS`}
          </button>
        </div>
      </div>
      <ModalFotos urls={urls} indiceInicial={modal.i} aberto={modal.aberto} onFechar={() => setModal((m) => ({ ...m, aberto: false }))} />
    </div>
  )
}
