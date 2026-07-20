'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'
import { Star } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import ModalConteudo from '@/components/atividades/ModalConteudo'

/**
 * @param {{
 *   usuarioAtorId: string
 *   usernameAtor: string
 *   interactorFoto: string | null
 *   hrefAtor: string
 *   nomeEmpresa: string
 *   empresaId: string
 *   empresaUsername?: string
 *   empresaFoto?: string | null
 *   nota: number
 *   feedback: string | null
 *   tempoInteracao?: string
 *   atorVerificado?: boolean
 *   atorVerificadoTipo?: 'profissional' | 'empresa'
 *   empresaVerificada?: boolean
 * }} props
 */
export default function AtividadeAvaliacao({
  usuarioAtorId: _usuarioAtorId,
  usernameAtor,
  interactorFoto,
  hrefAtor,
  nomeEmpresa,
  empresaId,
  empresaUsername = '',
  empresaFoto = null,
  nota,
  feedback,
  tempoInteracao = '',
  atorVerificado = false,
  atorVerificadoTipo = 'profissional',
  empresaVerificada = false,
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const notaVal = Math.min(5, Math.max(0, Math.round(Number(nota)) || 0))
  const usernameEmpresa = String(empresaUsername ?? '').trim().replace(/^@+/, '')
  const hrefEmpresa = empresaId ? `/empresa/${encodeURIComponent(empresaId)}` : ''
  const feedbackTrim = feedback != null && String(feedback).trim() !== '' ? String(feedback).trimEnd() : ''

  return (
    <>
      <div className="block min-w-0">
        <div className="grid min-w-0 grid-cols-[2.5rem_1fr] items-start gap-x-2">
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => router.push(hrefAtor)}
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
                onClick={() => router.push(hrefAtor)}
              />{' '}
              avaliou{' '}
              {hrefEmpresa ? (
                usernameEmpresa ? (
                  <UsuarioHandleVerificado
                    username={usernameEmpresa}
                    verificado={empresaVerificada}
                    verificadoTipo="empresa"
                    onClick={() => router.push(hrefEmpresa)}
                  />
                ) : (
                  <Link href={hrefEmpresa} className="font-medium text-[#0097b2] hover:underline">
                    {nomeEmpresa}
                  </Link>
                )
              ) : (
                <span className="font-medium text-gray-700">{usernameEmpresa ? `@${usernameEmpresa}` : nomeEmpresa}</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="mt-1.5 flex items-center gap-0.5 rounded-md py-0.5 text-left hover:opacity-90"
              aria-label={`Nota ${notaVal} de 5 — ver avaliação`}
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-5 w-5 shrink-0 ${s <= notaVal ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  aria-hidden
                />
              ))}
            </button>
          </div>
        </div>
      </div>
      <ModalConteudo aberto={modal} onFechar={() => setModal(false)} titulo="Avaliação">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {hrefEmpresa ? (
              <Link href={hrefEmpresa} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                <AvatarImage src={empresaFoto} alt="" fill className="object-cover" sizes="40px" />
              </Link>
            ) : (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                <AvatarImage src={empresaFoto} alt="" fill className="object-cover" sizes="40px" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-900">{nomeEmpresa}</p>
              {usernameEmpresa ? <p className="truncate text-sm text-gray-500">@{usernameEmpresa}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-0.5" aria-label={`Nota ${notaVal} de 5`}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-6 w-6 shrink-0 ${s <= notaVal ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                aria-hidden
              />
            ))}
          </div>
          {feedbackTrim ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{feedbackTrim}</p>
          ) : (
            <p className="text-sm text-gray-500">Sem feedback escrito.</p>
          )}
          <p className="text-xs text-gray-500">
            Avaliação de{' '}
            <button type="button" className="font-medium text-[#0097b2] hover:underline" onClick={() => router.push(hrefAtor)}>
              @{usernameAtor}
            </button>
          </p>
        </div>
      </ModalConteudo>
    </>
  )
}
