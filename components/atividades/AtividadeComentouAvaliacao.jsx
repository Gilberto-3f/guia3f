'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Star } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import ModalVisualizacao from '@/components/atividades/ModalVisualizacao'

/**
 * @param {{
 *   usernameAtor: string
 *   interactorFoto: string | null
 *   usernameDono: string
 *   hrefInteractor: string
 *   hrefDono: string
 *   textoComentario: string
 *   postId: string
 *   comentarioId?: string | null
 *   meta?: Record<string, unknown> | null
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   atorVerificado?: boolean
 *   atorVerificadoTipo?: 'profissional' | 'empresa'
 *   donoVerificado?: boolean
 *   donoVerificadoTipo?: 'profissional' | 'empresa'
 *   empresaUsername?: string
 *   hrefEmpresa?: string
 *   empresaVerificada?: boolean
 *   empresaFoto?: string | null
 * }} props
 */
export default function AtividadeComentouAvaliacao({
  usernameAtor,
  interactorFoto,
  usernameDono,
  hrefInteractor,
  hrefDono,
  textoComentario,
  postId,
  comentarioId = null,
  meta = null,
  tempoInteracao = '',
  modoMinhaConta = false,
  atorVerificado = false,
  atorVerificadoTipo = 'profissional',
  donoVerificado = false,
  donoVerificadoTipo = 'profissional',
  empresaUsername: empresaUsernameProp = '',
  hrefEmpresa: hrefEmpresaProp = '',
  empresaVerificada = false,
  empresaFoto = null,
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const nota = meta && typeof meta.nota === 'number' ? meta.nota : Number(meta?.nota) || 0
  const notaVal = Math.min(5, Math.max(0, Math.round(Number(nota)) || 0))

  const empresaIdMeta =
    meta?.empresa_id != null && String(meta.empresa_id).trim() !== '' ? String(meta.empresa_id).trim() : ''
  const usernameEmpresa =
    String(empresaUsernameProp ?? '').trim().replace(/^@+/, '') ||
    (meta?.nome_usuario != null && String(meta.nome_usuario).trim() !== ''
      ? String(meta.nome_usuario).trim().replace(/^@+/, '')
      : '')
  const hrefEmpresa =
    String(hrefEmpresaProp ?? '').trim() ||
    (empresaIdMeta ? `/empresa/${encodeURIComponent(empresaIdMeta)}` : '')
  const fotoEmpresa =
    empresaFoto != null && String(empresaFoto).trim() !== ''
      ? String(empresaFoto).trim()
      : meta?.foto_url != null && String(meta.foto_url).trim() !== ''
        ? String(meta.foto_url).trim()
        : null

  const resumoModal = modoMinhaConta
    ? 'comentou sua avaliação'
    : `comentou avaliação de @${usernameDono}`

  return (
    <>
      <div className="block min-w-0">
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
                username={usernameAtor}
                verificado={atorVerificado}
                verificadoTipo={atorVerificadoTipo}
                onClick={() => router.push(hrefInteractor)}
              />{' '}
              {modoMinhaConta ? (
                <>comentou sua avaliação</>
              ) : (
                <>
                  comentou avaliação de{' '}
                  <UsuarioHandleVerificado
                    username={usernameDono}
                    verificado={donoVerificado}
                    verificadoTipo={donoVerificadoTipo}
                    onClick={() => router.push(hrefDono)}
                  />
                </>
              )}
              :
            </p>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-md py-0.5 hover:opacity-90"
              aria-label={`Nota ${notaVal} de 5 — ver avaliação`}
            >
              {fotoEmpresa || hrefEmpresa ? (
                hrefEmpresa ? (
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(hrefEmpresa)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        router.push(hrefEmpresa)
                      }
                    }}
                    className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100"
                    aria-label={usernameEmpresa ? `Ver @${usernameEmpresa}` : 'Ver empresa'}
                  >
                    <AvatarImage src={fotoEmpresa} alt="" fill className="object-cover" sizes="36px" />
                  </span>
                ) : (
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    <AvatarImage src={fotoEmpresa} alt="" fill className="object-cover" sizes="36px" />
                  </span>
                )
              ) : null}
              <span className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-7 w-7 shrink-0 ${s <= notaVal ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                    aria-hidden
                  />
                ))}
              </span>
            </button>
            {String(textoComentario || '').trim() ? (
              <button
                type="button"
                onClick={() => setModal(true)}
                className="mt-1.5 block min-h-0 w-full text-left"
              >
                <p className="line-clamp-3 text-sm italic text-gray-600">
                  &ldquo;{String(textoComentario || '').trimEnd()}&rdquo;
                </p>
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <ModalVisualizacao
        aberto={modal}
        onFechar={() => setModal(false)}
        postIds={[postId]}
        comentarioId={comentarioId}
        interacaoUsuario={usernameAtor}
        interacaoResumo={resumoModal}
      />
    </>
  )
}
