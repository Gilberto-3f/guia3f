'use client'

import { useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { ShieldCheck } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import ModalVisualizacao from '@/components/atividades/ModalVisualizacao'

/**
 * Curtida num post de anúncio de profissional verificado.
 * @param {{
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   donorUsername: string
 *   hrefInteractor: string
 *   hrefDonor: string
 *   texto: string
 *   postId: string
 *   categoriaRotulo: string
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 * }} props
 */
export default function AtividadeCurtiuVerificacaoProfissional({
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  texto,
  postId,
  categoriaRotulo,
  tempoInteracao = '',
  modoMinhaConta = false,
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
              <Link href={hrefInteractor} className="font-medium text-[#0097b2] hover:underline">
                @{interactorUsername}
              </Link>{' '}
              {modoMinhaConta ? (
                'curtiu sua verificação'
              ) : (
                <>
                  curtiu a verificação de{' '}
                  <Link href={hrefDonor} className="font-medium text-[#0097b2] hover:underline">
                    @{donorUsername}
                  </Link>
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
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#0097b2]">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#00D443]" aria-hidden />
              <span>{categoriaRotulo || '—'}</span>
            </div>
          </div>
        </div>
      </div>
      <ModalVisualizacao
        aberto={modal}
        onFechar={() => setModal(false)}
        postIds={[postId]}
        interacaoUsuario={interactorUsername}
        interacaoResumo={`curtiu verificação de @${donorUsername}`}
      />
    </>
  )
}
