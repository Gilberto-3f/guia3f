'use client'

import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  FAVORITOS_ATUALIZADOS_EVENT,
  toggleFavorito,
  type FavoritoAlvoTipo,
  type FavoritosAtualizadosDetail,
} from '@/lib/favoritosTurista'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'

type Props = {
  usuarioId: string | null
  alvoId: string
  tipo: FavoritoAlvoTipo
  inicial?: boolean
  className?: string
  size?: number
  onChange?: (salvo: boolean) => void
}

/**
 * Estrela de salvar item do catálogo.
 * Turista → página /favoritos.
 * Profissional / ADM → Publicações Salvas (menu lateral).
 * Empresa → não salva mini-cards (botão oculto).
 * Instâncias do mesmo alvo ficam sincronizadas via evento global.
 */
export default function BotaoEstrelaFavorito({
  usuarioId,
  alvoId,
  tipo,
  inicial = false,
  className = '',
  size = 20,
  onChange,
}: Props) {
  const { perfilEhTurista, perfilEhEmpresa, loading: gateLoading } = useProfissionalGate()
  const [salvo, setSalvo] = useState(inicial)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSalvo(inicial)
  }, [inicial, alvoId])

  // Sincroniza com outras estrelas do mesmo produto (mini-card ↔ drawer ↔ hub).
  useEffect(() => {
    const onFav = (e: Event) => {
      const detail = (e as CustomEvent<FavoritosAtualizadosDetail>).detail
      if (!detail?.alvoId || detail.alvoId !== String(alvoId)) return
      if (detail.tipo != null && detail.tipo !== tipo) return
      if (typeof detail.salvo !== 'boolean') return
      setSalvo(detail.salvo)
      onChange?.(detail.salvo)
    }
    window.addEventListener(FAVORITOS_ATUALIZADOS_EVENT, onFav)
    return () => window.removeEventListener(FAVORITOS_ATUALIZADOS_EVENT, onFav)
  }, [alvoId, tipo, onChange])

  const onClick = useCallback(
    async (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!usuarioId || !alvoId || busy || perfilEhEmpresa) return
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
        const msg = err instanceof Error ? err.message : 'Não foi possível salvar.'
        window.alert(msg)
      } finally {
        setBusy(false)
      }
    },
    [usuarioId, alvoId, tipo, busy, salvo, onChange, perfilEhEmpresa],
  )

  const starCls = salvo || inicial ? 'fill-[#0097b2] text-[#0097b2]' : 'fill-none text-[#0097b2]'
  const rotuloSalvo = perfilEhTurista ? 'Remover dos favoritos' : 'Remover das publicações salvas'
  const rotuloSalvar = perfilEhTurista ? 'Salvar nos favoritos' : 'Salvar em Publicações Salvas'

  if (gateLoading) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className}`} aria-hidden>
        <Star className={starCls} size={size} strokeWidth={2.25} />
      </span>
    )
  }

  // Empresa: não salva mini-cards de outras empresas.
  if (perfilEhEmpresa) return null

  if (!usuarioId) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        title="Faça login para salvar"
        aria-hidden
      >
        <Star className={starCls} size={size} strokeWidth={2.25} />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      disabled={busy}
      className={`inline-flex shrink-0 items-center justify-center rounded-md p-0.5 text-[#0097b2] transition hover:opacity-80 disabled:opacity-50 ${className}`}
      aria-label={salvo ? rotuloSalvo : rotuloSalvar}
      aria-pressed={salvo}
      title={salvo ? rotuloSalvo : rotuloSalvar}
    >
      <Star
        className={salvo ? 'fill-[#0097b2] text-[#0097b2]' : 'fill-none text-[#0097b2]'}
        size={size}
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  )
}
