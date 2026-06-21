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
 *   conteudoUrl?: string | null
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   interactorVerificado?: boolean
 *   interactorVerificadoTipo?: 'profissional' | 'empresa'
 *   donorVerificado?: boolean
 *   donorVerificadoTipo?: 'profissional' | 'empresa'
 *   onAbrirStory?: () => void
 * }} props
 */
export default function AtividadeCurtiuStory({
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  conteudoUrl = null,
  tempoInteracao = '',
  modoMinhaConta = false,
  interactorVerificado = false,
  interactorVerificadoTipo = 'profissional',
  donorVerificado = false,
  donorVerificadoTipo = 'profissional',
  onAbrirStory,
}) {
  const router = useRouter()

  return (
    <div className="grid min-w-0 grid-cols-[2.5rem_1fr_auto] items-start gap-x-2 text-sm text-gray-800">
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
      <div className="min-w-0 self-center pt-0.5">
        <p className="leading-snug text-gray-800">
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
      <div className="shrink-0 self-center">
        {conteudoUrl ? (
          <button
            type="button"
            onClick={onAbrirStory}
            className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100 transition hover:opacity-90"
            aria-label="Abrir story"
          >
            <AvatarImage src={conteudoUrl} alt="" fill className="object-cover" sizes="36px" />
          </button>
        ) : onAbrirStory ? (
          <button
            type="button"
            onClick={onAbrirStory}
            className="text-left text-xs font-medium text-[#0097b2] hover:underline"
          >
            Ver story
          </button>
        ) : null}
      </div>
    </div>
  )
}
