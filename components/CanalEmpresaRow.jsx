'use client'

import AvatarImage from '@/components/AvatarImage'
import BandeiraPais from '@/components/BandeiraPais'
import CanalListaRow from '@/components/CanalListaRow'

/**
 * @param {string | null | undefined} v
 */
function normTxt(v) {
  return String(v ?? '').trim()
}

/**
 * Row de canal de empresa para profissionais (avatar + bandeira + nome + prévia da última mensagem).
 * @param {{
 *   canal: {
 *     id: string
 *     empresas?: {
 *       nome_fantasia?: string | null
 *       foto_url?: string | null
 *       cidade?: string | null
 *     } | null
 *     nome?: string | null
 *   }
 *   onClick: () => void
 *   active?: boolean
 *   preview?: string | null
 *   hora?: string | null
 *   naoLidas?: number
 * }} props
 */
export default function CanalEmpresaRow({
  canal,
  onClick,
  active = false,
  preview = null,
  hora = null,
  naoLidas = 0,
}) {
  const nomeEmpresa = normTxt(canal?.empresas?.nome_fantasia) || normTxt(canal?.nome) || 'Empresa'
  const fotoUrl = canal?.empresas?.foto_url ?? null
  const cidade = canal?.empresas?.cidade ?? null

  const label = (
    <span className="flex min-w-0 items-center gap-1.5">
      <BandeiraPais cidade={cidade} />
      <span className="truncate">{nomeEmpresa}</span>
    </span>
  )

  return (
    <CanalListaRow
      label={label}
      preview={preview ?? ' '}
      hora={hora}
      naoLidas={naoLidas}
      active={active}
      onClick={onClick}
      avatar={
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100">
          <AvatarImage src={fotoUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
        </div>
      }
    />
  )
}
