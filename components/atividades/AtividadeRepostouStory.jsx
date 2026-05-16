'use client'

import { Link } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import { normalizarUsernameAtividade } from '@/lib/formatarTextoRepostStory'

/**
 * @param {{
 *   reposterUsername: string
 *   reposterFoto: string | null
 *   hrefReposter: string
 *   originalUsername: string
 *   hrefOriginal: string
 *   conteudoUrl: string | null
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   onAbrirStory: () => void
 * }} props
 */
export default function AtividadeRepostouStory({
  reposterUsername,
  reposterFoto,
  hrefReposter,
  originalUsername,
  hrefOriginal,
  conteudoUrl,
  tempoInteracao = '',
  modoMinhaConta = false,
  onAbrirStory,
}) {
  const reposter = normalizarUsernameAtividade(reposterUsername) || 'usuario'
  const original = normalizarUsernameAtividade(originalUsername) || 'alguém'
  const hrefOriginalEfetivo = original !== 'alguém' ? hrefOriginal : hrefReposter

  return (
    <div className="grid min-w-0 grid-cols-[2.5rem_1fr_auto] items-start gap-x-2 text-sm text-gray-800">
      <div className="flex flex-col items-center gap-0.5">
        <Link href={hrefReposter} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
          <AvatarImage src={reposterFoto} alt="" fill className="object-cover" sizes="40px" />
        </Link>
        {tempoInteracao ? (
          <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">{tempoInteracao}</span>
        ) : null}
      </div>
      <div className="min-w-0 self-center pt-0.5">
        <p className="leading-snug text-gray-800">
          {modoMinhaConta ? (
            <>
              Você repostou um story em que foi marcado por{' '}
              {original !== 'alguém' ? (
                <Link href={hrefOriginalEfetivo} className="font-medium text-[#0097b2] hover:underline">
                  @{original}
                </Link>
              ) : (
                <span className="font-medium text-gray-700">alguém</span>
              )}
              .
            </>
          ) : (
            <>
              <Link href={hrefReposter} className="font-medium text-[#0097b2] hover:underline">
                @{reposter}
              </Link>{' '}
              repostou um story em que foi marcado por{' '}
              {original !== 'alguém' ? (
                <Link href={hrefOriginalEfetivo} className="font-medium text-[#0097b2] hover:underline">
                  @{original}
                </Link>
              ) : (
                <span className="font-medium text-gray-700">alguém</span>
              )}
              .
            </>
          )}
        </p>
      </div>
      <div className="shrink-0 self-center">
        {conteudoUrl ? (
          <button
            type="button"
            onClick={onAbrirStory}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 transition hover:opacity-90"
            aria-label="Abrir story"
          >
            <AvatarImage src={conteudoUrl} alt="" fill className="object-cover" sizes="64px" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onAbrirStory}
            className="text-left text-xs font-medium text-[#0097b2] hover:underline"
          >
            Ver story
          </button>
        )}
      </div>
    </div>
  )
}
