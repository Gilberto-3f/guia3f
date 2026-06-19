'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Star } from 'lucide-react'
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
 *   postId: string
 *   meta: Record<string, unknown> | null
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   interactorVerificado?: boolean
 *   interactorVerificadoTipo?: 'profissional' | 'empresa'
 *   donorVerificado?: boolean
 *   donorVerificadoTipo?: 'profissional' | 'empresa'
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
  tempoInteracao = '',
  modoMinhaConta = false,
  interactorVerificado = false,
  interactorVerificadoTipo = 'profissional',
  donorVerificado = false,
  donorVerificadoTipo = 'profissional',
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const nota = meta && typeof meta.nota === 'number' ? meta.nota : Number(meta?.nota) || 0
  const feedback =
    meta && typeof meta.feedback === 'string'
      ? meta.feedback
      : meta && typeof meta.comentario === 'string'
        ? meta.comentario
        : ''
  const notaVal = Math.min(5, Math.max(0, Math.round(Number(nota)) || 0))
  const nomeEmpresa =
    meta?.nome_fantasia != null && String(meta.nome_fantasia).trim() !== ''
      ? String(meta.nome_fantasia).trim()
      : 'Estabelecimento'
  const fotoEmpresa = meta?.foto_url != null && String(meta.foto_url).trim() !== '' ? String(meta.foto_url) : null
  const resumoModal = modoMinhaConta ? 'curtiu sua avaliação' : `curtiu avaliação de @${donorUsername}`

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
                'curtiu sua avaliação'
              ) : (
                <>
                  curtiu avaliação de{' '}
                  <UsuarioHandleVerificado
                    username={donorUsername}
                    verificado={donorVerificado}
                    verificadoTipo={donorVerificadoTipo}
                    onClick={() => router.push(hrefDonor)}
                  />
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="mt-2 w-full rounded-lg bg-white p-4 text-left shadow-sm hover:bg-gray-50"
            >
              <span className="flex min-w-0 items-start gap-3">
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  <AvatarImage src={fotoEmpresa} alt="" fill className="object-cover" sizes="40px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block max-w-full truncate font-semibold text-gray-900">{nomeEmpresa}</span>
                  <span className="mt-1 flex items-center gap-0.5" aria-label={`Nota ${notaVal} de 5`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-5 w-5 shrink-0 ${s <= notaVal ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                        aria-hidden
                      />
                    ))}
                  </span>
                </span>
              </span>
              {feedback ? (
                <span className="mt-3 block line-clamp-3 text-center text-sm leading-relaxed text-gray-700">
                  {String(feedback).trimEnd()}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
      <ModalVisualizacao
        aberto={modal}
        onFechar={() => setModal(false)}
        postIds={[postId]}
        interacaoUsuario={interactorUsername}
        interacaoResumo={resumoModal}
      />
    </>
  )
}
