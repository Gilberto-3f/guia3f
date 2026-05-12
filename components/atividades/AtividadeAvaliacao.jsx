'use client'

import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'
import { Star } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'

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
 * }} props
 */
export default function AtividadeAvaliacao({
  usuarioAtorId,
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
}) {
  const router = useRouter()
  const notaVal = Math.min(5, Math.max(0, Math.round(Number(nota)) || 0))
  const usernameEmpresa = String(empresaUsername ?? '').trim().replace(/^@+/, '')
  const hrefEmpresa = empresaId ? `/empresa/${encodeURIComponent(empresaId)}` : ''

  return (
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
            <button
              type="button"
              className="font-medium text-[#0097b2] hover:underline"
              onClick={() => router.push(hrefAtor)}
            >
              @{usernameAtor}
            </button>{' '}
            avaliou{' '}
            {hrefEmpresa ? (
              <Link href={hrefEmpresa} className="font-medium text-[#0097b2] hover:underline">
                {usernameEmpresa ? `@${usernameEmpresa}` : nomeEmpresa}
              </Link>
            ) : (
              <span className="font-medium text-gray-700">{usernameEmpresa ? `@${usernameEmpresa}` : nomeEmpresa}</span>
            )}
          </p>
          <div className="mt-2 flex flex-col items-center rounded-lg bg-gray-50 px-3 py-3 text-center">
            {hrefEmpresa ? (
              <Link href={hrefEmpresa} className="relative h-12 w-12 overflow-hidden rounded-md bg-gray-100">
                <AvatarImage src={empresaFoto} alt="" fill className="object-cover" sizes="48px" />
              </Link>
            ) : (
              <div className="relative h-12 w-12 overflow-hidden rounded-md bg-gray-100">
                <AvatarImage src={empresaFoto} alt="" fill className="object-cover" sizes="48px" />
              </div>
            )}
            {hrefEmpresa ? (
              <Link href={hrefEmpresa} className="mt-2 max-w-full truncate font-semibold text-gray-900 hover:underline">
                {nomeEmpresa}
              </Link>
            ) : (
              <p className="mt-2 max-w-full truncate font-semibold text-gray-900">{nomeEmpresa}</p>
            )}
            {usernameEmpresa ? <p className="max-w-full truncate text-sm text-gray-500">@{usernameEmpresa}</p> : null}
            <div className="mt-3 flex items-center justify-center gap-0.5" aria-label={`Nota ${notaVal} de 5`}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-6 w-6 shrink-0 ${s <= notaVal ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  aria-hidden
                />
              ))}
            </div>
            {feedback ? (
              <p className="mt-3 line-clamp-3 text-left text-sm leading-relaxed text-gray-800">{String(feedback).trimEnd()}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
