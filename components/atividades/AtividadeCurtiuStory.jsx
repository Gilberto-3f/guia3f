'use client'

import { Link } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'

/**
 * @param {{
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   donorUsername: string
 *   hrefInteractor: string
 *   hrefDonor: string
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
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
}) {
  return (
    <div className="min-w-0">
      <div className="grid min-w-0 grid-cols-[2.5rem_1fr] items-start gap-x-2">
        <div className="flex flex-col items-center gap-0.5">
          <Link href={hrefInteractor} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
            <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="40px" />
          </Link>
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
              'curtiu seu story'
            ) : (
              <>
                curtiu o story de{' '}
                <Link href={hrefDonor} className="font-medium text-[#0097b2] hover:underline">
                  @{donorUsername}
                </Link>
              </>
            )}
            .
          </p>
        </div>
      </div>
    </div>
  )
}
