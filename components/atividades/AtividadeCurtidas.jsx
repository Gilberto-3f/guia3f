'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from '@/i18n/navigation'
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
            <button type="button" onClick={() => router.push(hrefInteractor)} className="font-medium text-[#0097b2] hover:underline">
              @{interactorUsername}
            </button>{' '}
            curtiu {n === 1 ? 'foto' : `${n} fotos`} de{' '}
            <button type="button" onClick={() => router.push(hrefDonor)} className="font-medium text-[#0097b2] hover:underline">
              @{donorUsername}
            </button>
          </p>
          <div className="mt-3">
            <GridFotos urls={urls} max={10} onClickFoto={(i) => setModal({ aberto: true, i })} />
          </div>
          <button
            type="button"
            onClick={() => setModal({ aberto: true, i: 0 })}
            className="mt-3 text-sm font-medium text-[#0097b2]"
          >
            {n === 1 ? 'VER FOTO' : `VER TODAS AS ${n} FOTOS`}
          </button>
        </div>
      </div>
      <ModalFotos urls={urls} indiceInicial={modal.i} aberto={modal.aberto} onFechar={() => setModal((m) => ({ ...m, aberto: false }))} />
    </div>
  )
}
