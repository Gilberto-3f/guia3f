'use client'

import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'

const COR = '#0097b2'

function formatMesAno(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export type ProfissionalDrawerParticular = {
  nome_completo: string
  nome_usuario: string | null
  foto_url: string | null
  verificado: boolean
  verificado_em: string | null
}

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
    <div className="flex flex-col items-center gap-2 px-2 py-3 text-center">
      <div
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100"
        style={{ boxShadow: `0 0 0 4px ${COR}` }}
      >
        {prof.foto_url ? (
          <AvatarImage src={prof.foto_url} alt="" fill className="object-cover" sizes="80px" />
        ) : null}
      </div>
      <p className="max-w-md text-lg font-bold text-gray-900">{prof.nome_completo || 'Profissional'}</p>
      <UsuarioHandleVerificado
        username={username}
        verificado={prof.verificado}
        verificadoTipo="profissional"
        asButton={false}
        className="justify-center text-sm font-normal text-gray-600"
      />
      {mesAno ? (
        <p className="text-xs text-gray-500">{labelVerificadoDesde(mesAno)}</p>
      ) : null}
    </div>
  )
}
