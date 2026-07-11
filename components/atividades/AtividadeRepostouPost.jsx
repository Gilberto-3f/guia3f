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
 *   hrefInteractor: string
 *   postId: string
 *   previewUrl?: string | null
 *   previewTipo?: 'foto' | 'texto' | 'story'
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   interactorVerificado?: boolean
 *   interactorVerificadoTipo?: 'profissional' | 'empresa'
 * }} props
 */
export default function AtividadeRepostouPost({
  interactorUsername,
  interactorFoto,
  hrefInteractor,
  postId,
  previewUrl = null,
  previewTipo = 'texto',
  tempoInteracao = '',
  modoMinhaConta = false,
  interactorVerificado = false,
  interactorVerificadoTipo = 'profissional',
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)

  const rotuloConteudo =
    previewTipo === 'foto' ? 'sua foto' : previewTipo === 'story' ? 'seu story' : 'seu post'

  return (
    <>
      <div className="min-w-0">
        <div className="grid min-w-0 grid-cols-[2.5rem_1fr_auto] items-start gap-x-2">
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => router.push(hrefInteractor)}
              className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
            >
              <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="40px" />
            </button>
            {tempoInteracao ? (
              <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">
                {tempoInteracao}
              </span>
            ) : null}
          </div>
          <div className="min-w-0 self-center pt-0.5">
            <p className="text-sm leading-snug text-gray-800">
              <UsuarioHandleVerificado
                username={interactorUsername}
                verificado={interactorVerificado}
                verificadoTipo={interactorVerificadoTipo}
                onClick={() => router.push(hrefInteractor)}
              />{' '}
              {modoMinhaConta ? (
                <>repostou {rotuloConteudo}</>
              ) : (
                <>repostou um conteúdo</>
              )}
            </p>
          </div>
          <div className="shrink-0 self-center">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => setModal(true)}
                className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100 transition hover:opacity-90"
                aria-label="Abrir publicação"
              >
                <AvatarImage src={previewUrl} alt="" fill className="object-cover" sizes="36px" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setModal(true)}
                className="text-left text-xs font-medium text-[#0097b2] hover:underline"
              >
                Ver
              </button>
            )}
          </div>
        </div>
      </div>
      {modal ? (
        <ModalVisualizacao
          aberto={modal}
          onFechar={() => setModal(false)}
          postIds={[postId]}
          interacaoUsuario={interactorUsername}
          interacaoResumo={modoMinhaConta ? `repostou ${rotuloConteudo}` : 'repostou um conteúdo'}
        />
      ) : null}
    </>
  )
}
