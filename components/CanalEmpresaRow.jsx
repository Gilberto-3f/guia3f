'use client'

import AvatarImage from '@/components/AvatarImage'
import CanalListaRow from '@/components/CanalListaRow'

/**
 * @param {string | null | undefined} v
 */
function normTxt(v) {
  return String(v ?? '').trim()
}

/**
 * @param {string | null | undefined} handle
 */
function formatHandle(handle) {
  const h = normTxt(handle)
  if (!h) return ''
  return h.startsWith('@') ? h : `@${h}`
}

/**
 * @param {string | null | undefined} cidade
 * @returns {'BR' | 'PY' | 'AR' | null}
 */
function inferPaisPorCidade(cidade) {
  const c = normTxt(cidade).toLowerCase()
  if (!c) return null
  if (c.includes('foz')) return 'BR'
  if (c.includes('iguazu')) return 'AR'
  if (c.includes('ciudad')) return 'PY'
  return null
}

/**
 * Row de canal de empresa para profissionais.
 * @param {{
 *   canal: {
 *     id: string
 *     comunidade_prof?: string | null
 *     empresas?: {
 *       nome_fantasia?: string | null
 *       nome_usuario?: string | null
 *       foto_url?: string | null
 *       cidade?: string | null
 *     } | null
 *     nome?: string | null
 *   }
 *   comunidadeLabel?: string
 *   onClick: () => void
 *   active?: boolean
 *   preview?: string | null
 *   hora?: string | null
 *   naoLidas?: number
 * }} props
 */
export default function CanalEmpresaRow({
  canal,
  comunidadeLabel,
  onClick,
  active = false,
  preview = null,
  hora = null,
  naoLidas = 0,
}) {
  const nomeEmpresa = normTxt(canal?.empresas?.nome_fantasia) || normTxt(canal?.nome) || 'Empresa'
  const fotoUrl = canal?.empresas?.foto_url ?? null
  const pais = inferPaisPorCidade(canal?.empresas?.cidade)
  const handle = formatHandle(canal?.empresas?.nome_usuario)
  const subtitulo = normTxt(comunidadeLabel) || normTxt(canal?.comunidade_prof) || 'Comunidade'
  const paisEmoji = pais === 'BR' ? ' 🇧🇷' : pais === 'PY' ? ' 🇵🇾' : pais === 'AR' ? ' 🇦🇷' : ''
  const previewLinha = (preview || handle || subtitulo) + paisEmoji

  return (
    <CanalListaRow
      label={nomeEmpresa}
      preview={previewLinha}
      hora={hora}
      naoLidas={naoLidas}
      active={active}
      onClick={onClick}
      avatar={
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100">
          <AvatarImage src={fotoUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
        </div>
      }
    />
  )
}
