'use client'

import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'

/**
 * @param {{
 *   usuarioAtorId: string
 *   usernameAtor: string
 *   interactorFoto: string | null
 *   hrefAtor: string
 *   nomeEmpresa: string
 *   empresaId: string
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
  nota,
  feedback,
  tempoInteracao = '',
}) {
  const router = useRouter()
  const estrelas = '⭐'.repeat(Math.min(5, Math.max(1, Math.round(Number(nota)) || 1)))

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
            <Link href={`/empresa/${encodeURIComponent(empresaId)}`} className="font-medium text-gray-700 hover:text-[#0097b2]">
              {nomeEmpresa}
            </Link>{' '}
            com {estrelas}
          </p>
          {feedback ? (
            <p className="mt-1.5 line-clamp-3 text-base text-gray-700">{String(feedback).trimEnd()}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
