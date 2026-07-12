'use client'

import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toggleFavorito, type FavoritoAlvoTipo } from '@/lib/favoritosTurista'

type Props = {
  usuarioId: string | null
  alvoId: string
  tipo: FavoritoAlvoTipo
  inicial?: boolean
  className?: string
  size?: number
  onChange?: (salvo: boolean) => void
}

/** Estrela de favorito (azul logo). Clique salva/remove no guia do turista. */
export default function BotaoEstrelaFavorito({
  usuarioId,
  alvoId,
  tipo,
  inicial = false,
  className = '',
  size = 20,
  onChange,
}: Props) {
  const [salvo, setSalvo] = useState(inicial)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSalvo(inicial)
  }, [inicial, alvoId])

  const onClick = useCallback(
    async (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!usuarioId || !alvoId || busy) return
      setBusy(true)
      const prev = salvo
      setSalvo(!prev)
      try {
        const next = await toggleFavorito(supabase, usuarioId, alvoId, tipo)
        setSalvo(next)
        onChange?.(next)
      } catch (err) {
        console.error('[BotaoEstrelaFavorito]', err)
        setSalvo(prev)
      } finally {
        setBusy(false)
      }
    },
    [usuarioId, alvoId, tipo, busy, salvo, onChange],
  )

  if (!usuarioId) return null

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      disabled={busy}
      className={`shrink-0 rounded-md p-0.5 text-[#0097b2] transition hover:opacity-80 disabled:opacity-50 ${className}`}
      aria-label={salvo ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
      aria-pressed={salvo}
    >
      <Star
        className={salvo ? 'fill-[#0097b2] text-[#0097b2]' : 'text-[#0097b2]'}
        size={size}
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  )
}
