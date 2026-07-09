'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const PULL_MAX = 88
const PULL_TRIGGER = 56

/**
 * Pull-to-refresh no topo do feed (touch). Não marca posts — só chama `onRefresh`.
 * @param {{ onRefresh: () => void | Promise<void>, disabled?: boolean, children: import('react').ReactNode }} props
 */
export default function FeedPullRefresh({ onRefresh, disabled = false, children }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const pullDistRef = useRef(0)

  const runRefresh = useCallback(async () => {
    if (disabled || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      setPull(0)
      pullDistRef.current = 0
    }
  }, [disabled, onRefresh, refreshing])

  useEffect(() => {
    if (disabled) return

    const scrollNoTopo = () => (typeof window !== 'undefined' ? window.scrollY : 0) <= 4

    const onTouchStart = (e) => {
      if (refreshing || !scrollNoTopo()) return
      startYRef.current = e.touches[0]?.clientY ?? 0
      pullingRef.current = true
      pullDistRef.current = 0
    }

    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshing) return
      if (!scrollNoTopo()) {
        pullingRef.current = false
        setPull(0)
        pullDistRef.current = 0
        return
      }
      const y = e.touches[0]?.clientY ?? 0
      const delta = Math.max(0, y - startYRef.current)
      if (delta > 0) {
        pullDistRef.current = delta
        setPull(Math.min(delta, PULL_MAX))
        if (delta > 10) e.preventDefault()
      }
    }

    const onTouchEnd = () => {
      if (!pullingRef.current) return
      pullingRef.current = false
      const dist = pullDistRef.current
      if (dist >= PULL_TRIGGER) {
        void runRefresh()
      } else {
        setPull(0)
        pullDistRef.current = 0
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [disabled, refreshing, runRefresh])

  const indicadorVisivel = pull > 8 || refreshing
  const progresso = refreshing ? 1 : Math.min(1, pull / PULL_TRIGGER)

  return (
    <div className="relative">
      <div
        className="pointer-events-none fixed left-0 right-0 z-30 flex justify-center"
        style={{
          top: '3.25rem',
          opacity: indicadorVisivel ? 1 : 0,
          transform: `translateY(${Math.min(pull, PULL_MAX) * 0.25}px)`,
          transition: pullingRef.current ? 'none' : 'opacity 0.15s, transform 0.2s',
        }}
        aria-hidden={!indicadorVisivel}
      >
        <span
          className={`rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0097b2] shadow-md ${
            refreshing ? 'animate-pulse' : ''
          }`}
        >
          {refreshing ? 'Atualizando…' : progresso >= 1 ? 'Solte para atualizar' : 'Puxe para atualizar'}
        </span>
      </div>
      <div
        style={{
          transform: pull > 0 && !refreshing ? `translateY(${Math.min(pull * 0.35, 32)}px)` : undefined,
          transition: pullingRef.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}
