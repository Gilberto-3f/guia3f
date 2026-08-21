'use client'

import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
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
  /** Ex.: "Verificado desde março de 2024" */
  labelVerificadoDesde: (mesAno: string) => string
}

/** Bloco do profissional no drawer 1 de contratação dirigida (cartão de visita). */
export default function BlocoProfissionalDrawerParticular({
  prof,
  labelVerificadoDesde,
}: Props) {
  const mesAno = formatMesAno(prof.verificado_em)
  const username = String(prof.nome_usuario ?? '').replace(/^@+/, '') || 'usuario'

  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <div
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100"
        style={{ boxShadow: `0 0 0 3px ${COR}` }}
      >
        {prof.foto_url ? (
          <AvatarImage src={prof.foto_url} alt="" fill className="object-cover" sizes="64px" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold leading-tight text-gray-900">
          {prof.nome_completo || 'Profissional'}
        </p>
        <UsuarioHandleVerificado
          username={username}
          verificado={prof.verificado}
          verificadoTipo="profissional"
          asButton={false}
          className="justify-start text-sm font-normal text-gray-600"
        />
        {mesAno ? (
          <p className="mt-0.5 text-xs text-gray-500">{labelVerificadoDesde(mesAno)}</p>
        ) : null}
      </div>
    </div>
  )
}
