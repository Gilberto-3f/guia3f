'use client'

import { emojiBandeiraPais, inferCodigoPaisEmpresa } from '@/lib/empresaPaisUi'

/**
 * Bandeira (emoji) do país da empresa.
 * @param {{ cidade?: string | null, codigo?: 'BR' | 'PY' | 'AR' | null, className?: string }} props
 */
export default function BandeiraPais({ cidade, codigo = null, className = 'text-base leading-none' }) {
  const resolved = codigo ?? inferCodigoPaisEmpresa(cidade)
  const emoji = emojiBandeiraPais(resolved)
  if (!emoji) return null
  return (
    <span className={`inline-block shrink-0 ${className}`} aria-hidden>
      {emoji}
    </span>
  )
}
