'use client'

import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'

/**
 * @param {{
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   donorUsername: string
 *   hrefInteractor: string
 *   hrefDonor: string
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   interactorVerificado?: boolean
 *   interactorVerificadoTipo?: 'profissional' | 'empresa'
 *   donorVerificado?: boolean
 *   donorVerificadoTipo?: 'profissional' | 'empresa'
 * }} props
 */
export default function AtividadeCurtiuStory({
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  tempoInteracao = '',
  modoMinhaConta = false,
  interactorVerificado = false,
  interactorVerificadoTipo = 'profissional',
  donorVerificado = false,
  donorVerificadoTipo = 'profissional',
}) {
  const router = useRouter()

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
          <p className="text-sm leading-snug text-gray-800">
            <UsuarioHandleVerificado
              username={interactorUsername}
              verificado={interactorVerificado}
              verificadoTipo={interactorVerificadoTipo}
              onClick={() => router.push(hrefInteractor)}
            />{' '}
            {modoMinhaConta ? (
              'curtiu seu story'
            ) : (
              <>
                curtiu o story de{' '}
                <UsuarioHandleVerificado
                  username={donorUsername}
                  verificado={donorVerificado}
                  verificadoTipo={donorVerificadoTipo}
                  onClick={() => router.push(hrefDonor)}
                />
              </>
            )}
            .
          </p>
        </div>
      </div>
    </div>
  )
}
