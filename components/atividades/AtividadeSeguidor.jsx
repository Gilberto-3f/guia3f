'use client'

import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import { getPerfilHref } from '@/lib/perfil-utils'

/**
 * @param {{
 *   seguidorUsuarioId: string
 *   usernameSeguidor: string
 *   seguidorFoto: string | null
 *   usernameSeguido: string
 *   seguidoUsuarioId: string
 *   seguidoTipo: string
 *   empresaId: string | null
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   meuUsuarioId?: string | null
 * }} props
 */
export default function AtividadeSeguidor({
  seguidorUsuarioId,
  usernameSeguidor,
  seguidorFoto,
  usernameSeguido,
  seguidoUsuarioId,
  seguidoTipo,
  empresaId,
  tempoInteracao = '',
  modoMinhaConta = false,
  meuUsuarioId = null,
}) {
  const router = useRouter()
  const hrefAlvo = getPerfilHref({
    usuario_id: seguidoUsuarioId,
    tipo: seguidoTipo,
    role: seguidoTipo,
    empresa_id: empresaId,
  })
  /** Seguidor: rota social padrão (detalhe empresa/tipo pode vir do mapa na página de atividades). */
  const hrefSeguidor = `/perfil/${seguidorUsuarioId}`

  const euSouSeguido = Boolean(meuUsuarioId && String(seguidoUsuarioId) === String(meuUsuarioId))
  const euSouSeguidor = Boolean(meuUsuarioId && String(seguidorUsuarioId) === String(meuUsuarioId))
  const seguidoEhEmpresa = String(seguidoTipo ?? '').toLowerCase() === 'empresa' || Boolean(empresaId)

  return (
    <div className="grid min-w-0 grid-cols-[2.5rem_1fr] items-start gap-x-2 text-sm text-gray-800">
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
          onClick={() => router.push(hrefSeguidor)}
        >
          <AvatarImage src={seguidorFoto} alt="" fill className="object-cover" sizes="40px" />
        </button>
        {tempoInteracao ? (
          <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">{tempoInteracao}</span>
        ) : null}
      </div>
      <p className="min-w-0 pt-0.5 leading-snug">
        {modoMinhaConta && euSouSeguido ? (
          <>
            <button
              type="button"
              className="font-medium text-[#0097b2] hover:underline"
              onClick={() => router.push(hrefSeguidor)}
            >
              @{usernameSeguidor}
            </button>{' '}
            começou a seguir você
          </>
        ) : modoMinhaConta && euSouSeguidor ? (
          <>
            Você começou a seguir{' '}
            <Link href={hrefAlvo} className="font-medium text-[#0097b2] hover:underline">
              @{usernameSeguido}
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              className="font-medium text-[#0097b2] hover:underline"
              onClick={() => router.push(hrefSeguidor)}
            >
              @{usernameSeguidor}
            </button>{' '}
            {seguidoEhEmpresa ? 'começou a seguir a página da empresa ' : 'começou a seguir '}
            <Link href={hrefAlvo} className="font-medium text-[#0097b2] hover:underline">
              @{usernameSeguido}
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
