'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import GridFotos from '@/components/atividades/GridFotos'
import ModalVisualizacao from '@/components/atividades/ModalVisualizacao'

/**
 * @param {{
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   hrefInteractor: string
 *   postId: string
 *   previewUrl?: string | null
 *   previewTexto?: string
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
  previewTexto = '',
  previewTipo = 'texto',
  tempoInteracao = '',
  modoMinhaConta = false,
  interactorVerificado = false,
  interactorVerificadoTipo = 'profissional',
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)

  const ehFoto = previewTipo === 'foto' || previewTipo === 'story'
  const rotuloConteudo =
    previewTipo === 'foto' ? 'sua foto' : previewTipo === 'story' ? 'seu story' : 'seu post'
  const resumoModal = modoMinhaConta ? `repostou ${rotuloConteudo}` : 'repostou um conteúdo'

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
              <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">
                {tempoInteracao}
              </span>
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
              {modoMinhaConta ? <>repostou {rotuloConteudo}</> : <>repostou um conteúdo</>}
            </p>
            {ehFoto && previewUrl ? (
              <div className="mt-1.5">
                <GridFotos urls={[previewUrl]} onClickFoto={() => setModal(true)} />
              </div>
            ) : null}
            {!ehFoto ? (
              <button
                type="button"
                onClick={() => setModal(true)}
                className="mt-1.5 block min-h-0 w-full text-left"
              >
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-gray-800">
                  {String(previewTexto || '').trimEnd() || '—'}
                </p>
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {modal ? (
        <ModalVisualizacao
          aberto={modal}
          onFechar={() => setModal(false)}
          postIds={[postId]}
          interacaoUsuario={interactorUsername}
          interacaoResumo={resumoModal}
        />
      ) : null}
    </>
  )
}
