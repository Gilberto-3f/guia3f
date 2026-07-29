'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  COR_STATUS_MOBILIDADE,
  MOBILIDADE_HEARTBEAT_MS,
  MOBILIDADE_IDLE_RESPOSTA_MS,
  MOBILIDADE_ONLINE_IDLE_MS,
  parseMobilidadeStatus,
  type MobilidadeStatusId,
} from '@/lib/mobilidadeStatusProfissional'

type Props = {
  className?: string
}

function lerGps(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('gps'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('gps')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15_000 },
    )
  })
}

export default function ToggleStatusMobilidade({ className = '' }: Props) {
  const t = useTranslations('Mobilidade')
  const [status, setStatus] = useState<MobilidadeStatusId>('offline')
  const [onlineDesde, setOnlineDesde] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [idleAberto, setIdleAberto] = useState(false)
  const idleForceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const aplicarJson = useCallback((json: Record<string, unknown>) => {
    setStatus(parseMobilidadeStatus(json.status))
    setOnlineDesde(json.online_desde != null ? String(json.online_desde) : null)
  }, [])

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/profissional/mobilidade-status')
      const json = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
        setErro(String(json.error ?? t('statusErro')))
        return
      }
      if (json.elegivel === false) return
      aplicarJson(json)
    } catch {
      setErro(t('statusErro'))
    } finally {
      setLoading(false)
    }
  }, [aplicarJson, t])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const postStatus = useCallback(
    async (next: MobilidadeStatusId | null, opts?: { heartbeat?: boolean; lat?: number; lng?: number }) => {
      setBusy(true)
      setErro('')
      try {
        const res = await fetch('/api/profissional/mobilidade-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: next ?? undefined,
            heartbeat: opts?.heartbeat === true,
            lat: opts?.lat ?? null,
            lng: opts?.lng ?? null,
          }),
        })
        const json = (await res.json()) as Record<string, unknown>
        if (!res.ok) {
          setErro(String(json.error ?? t('statusErro')))
          return false
        }
        if (!opts?.heartbeat) aplicarJson(json)
        return true
      } catch {
        setErro(t('statusErro'))
        return false
      } finally {
        setBusy(false)
      }
    },
    [aplicarJson, t],
  )

  const forcarOffline = useCallback(async () => {
    setIdleAberto(false)
    if (idleForceRef.current) clearTimeout(idleForceRef.current)
    await postStatus('offline')
  }, [postStatus])

  const confirmarAindaDisponivel = useCallback(async () => {
    setIdleAberto(false)
    if (idleForceRef.current) clearTimeout(idleForceRef.current)
    try {
      const gps = await lerGps()
      await postStatus('online', { lat: gps.lat, lng: gps.lng })
    } catch {
      setErro(t('statusGpsObrigatorio'))
      await postStatus('offline')
    }
  }, [postStatus, t])

  // Timer 2h online sem aceite
  useEffect(() => {
    if (status !== 'online' || !onlineDesde) return
    const desde = new Date(onlineDesde).getTime()
    if (!Number.isFinite(desde)) return

    const tick = () => {
      if (Date.now() - desde >= MOBILIDADE_ONLINE_IDLE_MS) {
        setIdleAberto(true)
        if (idleForceRef.current) clearTimeout(idleForceRef.current)
        idleForceRef.current = setTimeout(() => {
          void forcarOffline()
        }, MOBILIDADE_IDLE_RESPOSTA_MS)
      }
    }

    tick()
    const id = setInterval(tick, 30_000)
    return () => {
      clearInterval(id)
      if (idleForceRef.current) clearTimeout(idleForceRef.current)
    }
  }, [status, onlineDesde, forcarOffline])

  // Heartbeat GPS
  useEffect(() => {
    if (status !== 'online' && status !== 'em_atendimento') return
    let cancelled = false
    const beat = async () => {
      try {
        const gps = await lerGps()
        if (cancelled) return
        await postStatus(null, { heartbeat: true, lat: gps.lat, lng: gps.lng })
      } catch {
        /* ignore */
      }
    }
    void beat()
    const id = setInterval(() => void beat(), MOBILIDADE_HEARTBEAT_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [status, postStatus])

  const onToggle = async () => {
    if (busy || loading) return
    if (status === 'em_atendimento') {
      setErro(t('statusEmAtendimentoHint'))
      return
    }
    if (status === 'online') {
      await postStatus('offline')
      return
    }
    try {
      const gps = await lerGps()
      await postStatus('online', { lat: gps.lat, lng: gps.lng })
    } catch {
      setErro(t('statusGpsObrigatorio'))
    }
  }

  if (loading) {
    return (
      <div className={`flex h-[56px] items-center justify-center ${className}`}>
        <span className="text-xs text-white/80 animate-pulse">…</span>
      </div>
    )
  }

  const cor = COR_STATUS_MOBILIDADE[status]
  const label =
    status === 'online'
      ? t('statusOnline')
      : status === 'em_atendimento'
        ? t('statusEmAtendimento')
        : t('statusOffline')

  return (
    <div className={`flex flex-col items-center justify-center gap-1 py-1 ${className}`}>
      <button
        type="button"
        onClick={() => void onToggle()}
        disabled={busy || status === 'em_atendimento'}
        className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 ring-2 ring-white/40 backdrop-blur-sm disabled:opacity-80"
        aria-pressed={status === 'online'}
        title={label}
      >
        <span
          className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors"
          style={{ backgroundColor: cor }}
        >
          <span
            className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
              status === 'offline' ? 'left-1' : 'left-6'
            }`}
          />
        </span>
        <span className="text-xs font-bold uppercase tracking-wide text-white">{label}</span>
      </button>
      {erro ? <p className="max-w-[220px] text-center text-[10px] text-amber-100">{erro}</p> : null}

      {idleAberto ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-lg font-bold text-gray-900">{t('idleTitulo')}</p>
            <p className="mt-2 text-sm text-gray-600">{t('idleDesc')}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void forcarOffline()}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700"
              >
                {t('idleNao')}
              </button>
              <button
                type="button"
                onClick={() => void confirmarAindaDisponivel()}
                className="flex-1 rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white"
              >
                {t('idleSim')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
