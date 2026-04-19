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
 *   modoMinhaConta?: boolean
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
  modoMinhaConta = false,
}) {
  const router = useRouter()
  const [modal, setModal] = useState({ aberto: false, i: 0 })
  const n = totalCurtidas ?? urls.length
  if (n === 0) return null

  const resumoModal =
    n === 1 ? `curtiu foto de @${donorUsername}` : `curtiu ${n} fotos de @${donorUsername}`

  const textoLinha = modoMinhaConta ? (
    <>
      <button type="button" onClick={() => router.push(hrefInteractor)} className="font-medium text-[#0097b2] hover:underline">
        @{interactorUsername}
      </button>{' '}
      {n === 1 ? 'curtiu sua foto' : 'curtiu suas fotos'}
    </>
  ) : (
    <>
      <button type="button" onClick={() => router.push(hrefInteractor)} className="font-medium text-[#0097b2] hover:underline">
        @{interactorUsername}
      </button>{' '}
      curtiu {n === 1 ? 'foto' : `${n} fotos`} de{' '}
      <button type="button" onClick={() => router.push(hrefDonor)} className="font-medium text-[#0097b2] hover:underline">
        @{donorUsername}
      </button>
    </>
  )

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 grid-cols-[2.5rem_1fr] items-start gap-x-2">
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => router.push(hrefInteractor)}
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
          >
            <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="40px" />
          </button>
          {tempoInteracao ? (
            <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">{tempoInteracao}</span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="text-sm leading-snug text-gray-800">{textoLinha}</p>
          <div className="mt-2">
            <GridFotos urls={urls} max={10} onClickFoto={(i) => setModal({ aberto: true, i })} />
          </div>
        </div>
      </div>
      <ModalVisualizacao
        aberto={modal.aberto}
        onFechar={() => setModal((m) => ({ ...m, aberto: false }))}
        postIds={postIds}
        indiceInicial={modal.i}
        interacaoUsuario={interactorUsername}
        interacaoResumo={resumoModal}
        thumbUrls={urls}
      />
    </div>
  )
}
