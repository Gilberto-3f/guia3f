'use client'

import { useCallback, useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'

type Props = {
  empresaId: string
  size?: number
  className?: string
}

/**
 * Alfinete azul: turista no manifesto (hoje ou agendado) marca a empresa no itinerário.
 */
export default function BotaoAlfineteItinerario({ empresaId, size = 22, className = '' }: Props) {
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
      className={`flex items-center justify-center rounded-lg p-1.5 transition-opacity hover:bg-[#0097b2]/10 disabled:opacity-50 ${className}`}
      aria-pressed={fixado}
      aria-label={fixado ? 'Remover do itinerário' : 'Marcar no itinerário do manifesto'}
      title={fixado ? 'No itinerário' : 'Marcar no itinerário'}
    >
      <MapPin
        className={fixado ? 'text-[#0097b2]' : 'text-gray-400'}
        size={size}
        strokeWidth={fixado ? 2.5 : 2}
        fill={fixado ? '#0097b2' : 'none'}
        aria-hidden
      />
    </button>
  )
}
