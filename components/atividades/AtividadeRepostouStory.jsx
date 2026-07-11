'use client'

import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
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
 *   euRepostei?: boolean
 *   reposterVerificado?: boolean
 *   reposterVerificadoTipo?: 'profissional' | 'empresa'
 *   originalVerificado?: boolean
 *   originalVerificadoTipo?: 'profissional' | 'empresa'
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
  euRepostei = false,
  reposterVerificado = false,
  reposterVerificadoTipo = 'profissional',
  originalVerificado = false,
  originalVerificadoTipo = 'profissional',
  onAbrirStory,
}) {
  const router = useRouter()
  const reposter = normalizarUsernameAtividade(reposterUsername) || 'usuario'
  const original = normalizarUsernameAtividade(originalUsername) || 'alguém'
  const hrefOriginalEfetivo = original !== 'alguém' ? hrefOriginal : hrefReposter

  const textoMinhaConta =
    euRepostei ? (
      <>
        Você repostou um story de{' '}
        {original !== 'alguém' ? (
          <UsuarioHandleVerificado
            username={original}
            verificado={originalVerificado}
            verificadoTipo={originalVerificadoTipo}
            onClick={() => router.push(hrefOriginalEfetivo)}
          />
        ) : (
          <span className="font-medium text-gray-700">alguém</span>
        )}
        .
      </>
    ) : (
      <>
        <UsuarioHandleVerificado
          username={reposter}
          verificado={reposterVerificado}
          verificadoTipo={reposterVerificadoTipo}
          onClick={() => router.push(hrefReposter)}
        />{' '}
        repostou seu story.
      </>
    )

  return (
    <div className="grid min-w-0 grid-cols-[2.5rem_1fr_auto] items-start gap-x-2 text-sm text-gray-800">
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={() => router.push(hrefReposter)}
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
        >
          <AvatarImage src={reposterFoto} alt="" fill className="object-cover" sizes="40px" />
        </button>
        {tempoInteracao ? (
          <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">{tempoInteracao}</span>
        ) : null}
      </div>
      <div className="min-w-0 self-center pt-0.5">
        <p className="leading-snug text-gray-800">
          {modoMinhaConta ? (
            textoMinhaConta
          ) : (
            <>
              <UsuarioHandleVerificado
                username={reposter}
                verificado={reposterVerificado}
                verificadoTipo={reposterVerificadoTipo}
                onClick={() => router.push(hrefReposter)}
              />{' '}
              repostou um story de{' '}
              {original !== 'alguém' ? (
                <UsuarioHandleVerificado
                  username={original}
                  verificado={originalVerificado}
                  verificadoTipo={originalVerificadoTipo}
                  onClick={() => router.push(hrefOriginalEfetivo)}
                />
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
            className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100 transition hover:opacity-90"
            aria-label="Abrir story"
          >
            <AvatarImage src={conteudoUrl} alt="" fill className="object-cover" sizes="36px" />
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
