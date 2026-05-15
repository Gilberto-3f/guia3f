'use client'

import { useEffect, useState } from 'react'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'

/**
 * Data relativa calculada só no cliente (evita hydration mismatch com "Agora").
 * @param {{
 *   iso: string
 *   className?: string
 *   as?: 'span' | 'time'
 * }} props
 */
export default function DataRelativaPublicacao({ iso, className = '', as = 'span' }) {
  const [texto, setTexto] = useState('')
  useEffect(() => {
    setTexto(formatarDataRelativaPublicacao(iso))
  }, [iso])
  const Tag = as
  return (
    <Tag className={className} suppressHydrationWarning dateTime={as === 'time' ? iso : undefined}>
      {texto || '\u00a0'}
    </Tag>
  )
}
