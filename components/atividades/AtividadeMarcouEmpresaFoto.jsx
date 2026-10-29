'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import ModalVisualizacao from '@/components/atividades/ModalVisualizacao'

/**
 * @param {{
 *   autorUsername: string
 *   autorFoto: string | null
 *   hrefAutor: string
 *   postId: string
 *   fotoUrl?: string | null
 *   tempoInteracao?: string
 *   atorVerificado?: boolean
 *   atorVerificadoTipo?: 'profissional' | 'empresa'
 * }} props
 */
export default function AtividadeMarcouEmpresaFoto({
  autorUsername,
  autorFoto,
  hrefAutor,
  postId,
  fotoUrl = null,
  tempoInteracao = '',
  atorVerificado = false,
  atorVerificadoTipo = 'profissional',
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)

  return (
    <>
      <div className="grid min-w-0 grid-cols-[2.5rem_1fr] items-start gap-x-2 text-sm text-gray-800">
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => router.push(hrefAutor)}
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
            aria-label={`Perfil de @${autorUsername}`}
          >
            <AvatarImage src={autorFoto} alt="" fill className="object-cover" sizes="40px" />
          </button>
          {tempoInteracao ? (
            <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">
              {tempoInteracao}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="flex min-w-0 items-center gap-3 rounded-xl p-1 text-left transition hover:bg-gray-100"
        >
          <span className="min-w-0 flex-1">
            <span className="text-sm leading-snug text-gray-800">
              <UsuarioHandleVerificado
                username={autorUsername}
                verificado={atorVerificado}
                verificadoTipo={atorVerificadoTipo}
                onClick={() => router.push(hrefAutor)}
              />{' '}
              marcou sua empresa em uma foto
            </span>
          </span>
          {fotoUrl ? (
            <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
              <AvatarImage src={fotoUrl} alt="" fill className="object-cover" sizes="36px" />
            </span>
          ) : null}
        </button>
      </div>
      <ModalVisualizacao
        aberto={modal}
        onFechar={() => setModal(false)}
        postIds={[postId]}
        interacaoUsuario={autorUsername}
        interacaoResumo={`marcou sua empresa em uma foto`}
      />
    </>
  )
}
