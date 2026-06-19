'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import ModalVisualizacao from '@/components/atividades/ModalVisualizacao'

/**
 * @param {{
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   donorUsername: string
 *   hrefInteractor: string
 *   hrefDonor: string
 *   texto: string
 *   postId: string
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   interactorVerificado?: boolean
 *   interactorVerificadoTipo?: 'profissional' | 'empresa'
 *   donorVerificado?: boolean
 *   donorVerificadoTipo?: 'profissional' | 'empresa'
 * }} props
 */
export default function AtividadeCurtiuPost({
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  texto,
  postId,
  tempoInteracao = '',
  modoMinhaConta = false,
  interactorVerificado = false,
  interactorVerificadoTipo = 'profissional',
  donorVerificado = false,
  donorVerificadoTipo = 'profissional',
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)

  return (
    <>
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
            <p className="text-sm leading-snug text-gray-800">
              <UsuarioHandleVerificado
                username={interactorUsername}
                verificado={interactorVerificado}
                verificadoTipo={interactorVerificadoTipo}
                onClick={() => router.push(hrefInteractor)}
              />{' '}
              {modoMinhaConta ? (
                'curtiu seu post'
              ) : (
                <>
                  curtiu post de{' '}
                  <UsuarioHandleVerificado
                    username={donorUsername}
                    verificado={donorVerificado}
                    verificadoTipo={donorVerificadoTipo}
                    onClick={() => router.push(hrefDonor)}
                  />
                </>
              )}
              :
            </p>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="mt-1.5 block min-h-0 w-full text-left"
            >
              <p className="line-clamp-3 whitespace-pre-wrap text-base text-gray-800">
                {String(texto || '').trimEnd() || '—'}
              </p>
            </button>
          </div>
        </div>
      </div>
      <ModalVisualizacao
        aberto={modal}
        onFechar={() => setModal(false)}
        postIds={[postId]}
        interacaoUsuario={interactorUsername}
        interacaoResumo={`curtiu post de @${donorUsername}`}
      />
    </>
  )
}
