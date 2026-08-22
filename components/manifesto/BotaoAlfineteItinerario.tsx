'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Plus } from 'lucide-react'

type Props = {
  empresaId: string
  size?: number
  className?: string
}

/**
 * Círculo + : turista no manifesto (hoje ou agendado) marca a empresa no itinerário.
 */
export default function BotaoAlfineteItinerario({ empresaId, size = 18, className = '' }: Props) {
  const [elegivel, setElegivel] = useState(false)
  const [fixado, setFixado] = useState(false)
  const [busy, setBusy] = useState(false)
  const [carregou, setCarregou] = useState(false)

  const sync = useCallback(async () => {
    if (!empresaId) return
    try {
      const res = await fetch(`/api/turista/manifesto/alfinete?empresa_id=${encodeURIComponent(empresaId)}`)
      const json = (await res.json()) as { elegivel?: boolean; fixado?: boolean }
      if (!res.ok) {
        setElegivel(false)
        setFixado(false)
        return
      }
      setElegivel(Boolean(json.elegivel))
      setFixado(Boolean(json.fixado))
    } catch {
      setElegivel(false)
      setFixado(false)
    } finally {
      setCarregou(true)
    }
  }, [empresaId])

  useEffect(() => {
    void sync()
  }, [sync])

  const toggle = async () => {
    if (busy || !elegivel) return
    setBusy(true)
    try {
      if (fixado) {
        const res = await fetch(
          `/api/turista/manifesto/alfinete?empresa_id=${encodeURIComponent(empresaId)}`,
          { method: 'DELETE' },
        )
        if (res.ok) setFixado(false)
      } else {
        const res = await fetch('/api/turista/manifesto/alfinete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresa_id: empresaId }),
        })
        if (res.ok) setFixado(true)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!carregou || !elegivel) return null

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0097b2] text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${className}`}
      aria-pressed={fixado}
      aria-label={fixado ? 'Remover do itinerário' : 'Marcar no itinerário do manifesto'}
      title={fixado ? 'No itinerário' : 'Marcar no itinerário'}
    >
      {fixado ? (
        <Check size={size} strokeWidth={2.5} aria-hidden />
      ) : (
        <Plus size={size} strokeWidth={2.5} aria-hidden />
      )}
    </button>
  )
}
