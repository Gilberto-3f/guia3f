'use client'

import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
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
 *   hrefSeguidor?: string
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   meuUsuarioId?: string | null
 *   seguidorVerificado?: boolean
 *   seguidorVerificadoTipo?: 'profissional' | 'empresa'
 *   seguidoVerificado?: boolean
 *   seguidoVerificadoTipo?: 'profissional' | 'empresa'
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
  hrefSeguidor,
  tempoInteracao = '',
  modoMinhaConta = false,
  meuUsuarioId = null,
  seguidorVerificado = false,
  seguidorVerificadoTipo = 'profissional',
  seguidoVerificado = false,
  seguidoVerificadoTipo = 'profissional',
}) {
  const router = useRouter()
  const hrefAlvo = getPerfilHref({
    usuario_id: seguidoUsuarioId,
    tipo: seguidoTipo,
    role: seguidoTipo,
    empresa_id: empresaId,
  })
  const hrefSeguidorDestino = hrefSeguidor || `/perfil/${seguidorUsuarioId}`

  const euSouSeguido = Boolean(meuUsuarioId && String(seguidoUsuarioId) === String(meuUsuarioId))
  const euSouSeguidor = Boolean(meuUsuarioId && String(seguidorUsuarioId) === String(meuUsuarioId))
  const seguidoEhEmpresa = String(seguidoTipo ?? '').toLowerCase() === 'empresa' || Boolean(empresaId)

  return (
    <div className="grid min-w-0 grid-cols-[2.5rem_1fr] items-start gap-x-2 text-sm text-gray-800">
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
          onClick={() => router.push(hrefSeguidorDestino)}
        >
          <AvatarImage src={seguidorFoto} alt="" fill className="object-cover" sizes="40px" />
        </button>
        {tempoInteracao ? (
          <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">{tempoInteracao}</span>
        ) : null}
      </div>
      <p className="min-w-0 pt-0.5 leading-snug">
        {modoMinhaConta && seguidoEhEmpresa ? (
          <>
            <UsuarioHandleVerificado
              username={usernameSeguidor}
              verificado={seguidorVerificado}
              verificadoTipo={seguidorVerificadoTipo}
              onClick={() => router.push(hrefSeguidorDestino)}
            />{' '}
            começou a seguir sua página
          </>
        ) : modoMinhaConta && euSouSeguido ? (
          <>
            <UsuarioHandleVerificado
              username={usernameSeguidor}
              verificado={seguidorVerificado}
              verificadoTipo={seguidorVerificadoTipo}
              onClick={() => router.push(hrefSeguidorDestino)}
            />{' '}
            começou a seguir você
          </>
        ) : modoMinhaConta && euSouSeguidor ? (
          <>
            Você começou a seguir{' '}
            <UsuarioHandleVerificado
              username={usernameSeguido}
              verificado={seguidoVerificado}
              verificadoTipo={seguidoVerificadoTipo}
              onClick={() => router.push(hrefAlvo)}
            />
          </>
        ) : (
          <>
            <UsuarioHandleVerificado
              username={usernameSeguidor}
              verificado={seguidorVerificado}
              verificadoTipo={seguidorVerificadoTipo}
              onClick={() => router.push(hrefSeguidorDestino)}
            />{' '}
            {seguidoEhEmpresa ? 'começou a seguir a página da empresa ' : 'começou a seguir '}
            <UsuarioHandleVerificado
              username={usernameSeguido}
              verificado={seguidoVerificado}
              verificadoTipo={seguidoVerificadoTipo}
              onClick={() => router.push(hrefAlvo)}
            />
          </>
        )}
      </p>
    </div>
  )
}
