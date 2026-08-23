'use client'

import { UserRound } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { propsUmToque } from '@/lib/umToque'

export type ParteFloating = {
  nome: string
  username: string | null
  foto_url: string | null
  verificado?: boolean
  nota_media?: number | null
}

type Props = {
  parte: ParteFloating | null
  fallbackNome: string
  onAbrir: () => void
  ariaLabel: string
  categoriaLabel?: string | null
}

/** Mini card da outra parte no floating (header verde) — toque abre o drawer. */
export default function CardParteAtendimentoFlutuante({
  parte,
  fallbackNome,
  onAbrir,
  ariaLabel,
  categoriaLabel,
}: Props) {
  const username = String(parte?.username ?? '').replace(/^@+/, '') || 'usuario'

  return (
    <button
      type="button"
      {...propsUmToque(onAbrir)}
      className="flex w-full cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-gray-200 bg-[#f5f5f5] px-3 py-3 text-left active:bg-gray-100"
      aria-label={ariaLabel}
    >
      <div
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white"
        style={{ boxShadow: '0 0 0 2px #00D443' }}
      >
        {parte?.foto_url ? (
          <AvatarImage src={parte.foto_url} alt="" fill className="object-cover" sizes="48px" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[#0097b2]">
            <UserRound className="h-6 w-6" aria-hidden />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight text-gray-900">
          {parte?.nome || fallbackNome}
        </p>
        <UsuarioHandleVerificado
          username={username}
          verificado={Boolean(parte?.verificado)}
          verificadoTipo="profissional"
          notaMedia={parte?.nota_media ?? null}
          asButton={false}
          className="text-xs font-normal leading-tight text-gray-600"
        />
        {categoriaLabel ? (
          <p className="mt-0.5 truncate text-xs font-medium text-[#0097b2]">{categoriaLabel}</p>
        ) : null}
      </div>
    </button>
  )
}
