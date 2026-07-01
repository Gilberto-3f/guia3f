'use client'

import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'

/**
 * Card centralizado (estilo popup de avaliações).
 */
export function CardUsuarioConvite({
  nomeSocial,
  username,
  fotoUrl,
  verificado = false,
  verificadoTipo = 'profissional',
}: {
  nomeSocial: string
  username: string
  fotoUrl: string | null
  verificado?: boolean
  verificadoTipo?: 'profissional' | 'empresa'
}) {
  const handle = username.replace(/^@+/, '')
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center rounded-2xl border border-gray-100 bg-white px-4 py-5 shadow-sm">
      <AvatarImage
        src={fotoUrl}
        alt={nomeSocial}
        className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-[#0097b2]/20"
      />
      <p className="mt-3 text-center text-sm font-bold text-gray-900">{nomeSocial}</p>
      <div className="mt-0.5 text-center text-sm text-[#0097b2]">
        <UsuarioHandleVerificado
          username={handle}
          verificado={verificado}
          verificadoTipo={verificadoTipo}
          className="justify-center"
        />
      </div>
    </div>
  )
}
