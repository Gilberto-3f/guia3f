'use client'

import { ChevronRight } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'

/**
 * @param {string | null | undefined} v
 */
function normTxt(v) {
  return String(v ?? '').trim()
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
 * @param {{
 *  codigo: 'BR' | 'PY' | 'AR'
 * }} props
 */
function FlagBadge({ codigo }) {
  const map = { BR: '🇧🇷', PY: '🇵🇾', AR: '🇦🇷' }
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs"
      aria-label={codigo}
      title={codigo}
    >
      {map[codigo]}
    </span>
  )
}

/**
 * Row de canal de empresa para profissionais.
 * @param {{
 *   canal: {
 *     id: string
 *     comunidade_prof?: string | null
 *     empresas?: { nome_fantasia?: string | null; foto_url?: string | null; cidade?: string | null } | null
 *     nome?: string | null
 *   }
 *   comunidadeLabel?: string
 *   onClick: () => void
 *   active?: boolean
 * }} props
 */
export default function CanalEmpresaRow({ canal, comunidadeLabel, onClick, active = false }) {
  const nomeEmpresa = normTxt(canal?.empresas?.nome_fantasia) || normTxt(canal?.nome) || 'Empresa'
  const fotoUrl = canal?.empresas?.foto_url ?? null
  const pais = inferPaisPorCidade(canal?.empresas?.cidade)
  const subtitulo = normTxt(comunidadeLabel) || normTxt(canal?.comunidade_prof) || 'Comunidade'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-gray-100 p-4 text-left transition-colors ${
        active ? 'bg-[#0097b2]/5' : 'hover:bg-gray-50'
      }`}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
        <AvatarImage src={fotoUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-gray-800">{nomeEmpresa}</span>
          {pais ? <FlagBadge codigo={pais} /> : null}
        </div>
        <div className="text-xs text-gray-500">{subtitulo}</div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
    </button>
  )
}

