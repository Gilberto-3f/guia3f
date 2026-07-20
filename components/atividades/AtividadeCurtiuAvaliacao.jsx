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
 *   empresaUsername?: string
 *   hrefEmpresa?: string
 *   empresaVerificada?: boolean
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
  empresaUsername: empresaUsernameProp = '',
  hrefEmpresa: hrefEmpresaProp = '',
  empresaVerificada = false,
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const nota = meta && typeof meta.nota === 'number' ? meta.nota : Number(meta?.nota) || 0
  const notaVal = Math.min(5, Math.max(0, Math.round(Number(nota)) || 0))

  const empresaIdMeta =
    meta?.empresa_id != null && String(meta.empresa_id).trim() !== '' ? String(meta.empresa_id).trim() : ''
  const usernameEmpresaMeta =
    meta?.nome_usuario != null && String(meta.nome_usuario).trim() !== ''
      ? String(meta.nome_usuario).trim().replace(/^@+/, '')
      : meta?.nome_fantasia != null && String(meta.nome_fantasia).trim() !== ''
        ? String(meta.nome_fantasia).trim()
        : ''
  const usernameEmpresa =
    String(empresaUsernameProp ?? '').trim().replace(/^@+/, '') || usernameEmpresaMeta
  const hrefEmpresa =
    String(hrefEmpresaProp ?? '').trim() ||
    (empresaIdMeta ? `/empresa/${encodeURIComponent(empresaIdMeta)}` : '')

  const resumoModal = modoMinhaConta
    ? usernameEmpresa
      ? `curtiu avaliação que você fez para @${usernameEmpresa}`
      : 'curtiu sua avaliação'
    : usernameEmpresa
      ? `curtiu avaliação que @${donorUsername} fez para @${usernameEmpresa}`
      : `curtiu avaliação de @${donorUsername}`

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
                <>
                  curtiu avaliação que você fez
                  {usernameEmpresa ? (
                    <>
                      {' '}
                      para{' '}
                      {hrefEmpresa ? (
                        <UsuarioHandleVerificado
                          username={usernameEmpresa}
                          verificado={empresaVerificada}
                          verificadoTipo="empresa"
                          onClick={() => router.push(hrefEmpresa)}
                        />
                      ) : (
                        <span className="font-medium text-[#0097b2]">@{usernameEmpresa}</span>
                      )}
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  curtiu avaliação que{' '}
                  <UsuarioHandleVerificado
                    username={donorUsername}
                    verificado={donorVerificado}
                    verificadoTipo={donorVerificadoTipo}
                    onClick={() => router.push(hrefDonor)}
                  />{' '}
                  fez
                  {usernameEmpresa ? (
                    <>
                      {' '}
                      para{' '}
                      {hrefEmpresa ? (
                        <UsuarioHandleVerificado
                          username={usernameEmpresa}
                          verificado={empresaVerificada}
                          verificadoTipo="empresa"
                          onClick={() => router.push(hrefEmpresa)}
                        />
                      ) : (
                        <span className="font-medium text-[#0097b2]">@{usernameEmpresa}</span>
                      )}
                    </>
                  ) : null}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="mt-2 flex w-full items-center justify-center gap-0.5 rounded-md py-0.5 hover:opacity-90"
              aria-label={`Nota ${notaVal} de 5 — ver avaliação`}
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-7 w-7 shrink-0 ${s <= notaVal ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  aria-hidden
                />
              ))}
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
