'use client'

import { Star } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { formatarNotaExibicao } from '@/lib/notaMediaAvaliacoes'
import type { ProfissionalDrawerParticular } from '@/lib/profissionalDrawerParticular'

const COR = '#0097b2'

function formatMesAno(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export type { ProfissionalDrawerParticular }

type Props = {
  prof: ProfissionalDrawerParticular
  /** Prefixo i18n, ex.: "Verificado desde" — mês/ano entra em negrito. */
  labelVerificadoPrefixo: string
}

/** Bloco do profissional nos drawers de contratação dirigida (cartão de visita). */
export default function BlocoProfissionalDrawerParticular({
  prof,
  labelVerificadoPrefixo,
}: Props) {
  const mesAno = formatMesAno(prof.verificado_em)
  const username = String(prof.nome_usuario ?? '').replace(/^@+/, '') || 'usuario'
  const notaTxt = formatarNotaExibicao(prof.nota_media)
  const categoria = String(prof.categoria_label ?? '').trim()

  return (
    <div className="flex flex-col items-center px-1 py-2 text-center">
      <div
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100"
        style={{ boxShadow: `0 0 0 3px ${COR}` }}
      >
        {prof.foto_url ? (
          <AvatarImage src={prof.foto_url} alt="" fill className="object-cover" sizes="64px" />
        ) : null}
      </div>
      <p className="mt-2 truncate text-lg font-bold leading-tight text-gray-900">
        {prof.nome_completo || 'Profissional'}
      </p>
      <UsuarioHandleVerificado
        username={username}
        verificado={prof.verificado}
        verificadoTipo="profissional"
        asButton={false}
        className="justify-center text-sm font-normal text-gray-600"
      />
      {categoria ? (
        <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-gray-700">
          <span>{categoria}</span>
          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
          <span className="font-semibold tabular-nums">{notaTxt}</span>
        </p>
      ) : (
        <p className="mt-0.5 flex items-center justify-center gap-1 text-sm text-gray-700">
          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
          <span className="font-semibold tabular-nums">{notaTxt}</span>
        </p>
      )}
      {mesAno ? (
        <p className="mt-1 text-xs text-gray-500">
          {labelVerificadoPrefixo} <strong className="font-bold text-gray-600">{mesAno}</strong>
        </p>
      ) : null}
    </div>
  )
}
