'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { resolverUrlAnexoMensagemCanal, urlPublicaAnexoMensagemCanal } from '@/lib/canalAnexoUrl'

/**
 * Player de mensagem de áudio no canal (toque em play para ouvir).
 * @param {{ src: string; isOwn?: boolean }} props
 */
export default function CanalMensagemAudio({ src, isOwn = false }) {
  const urlPublica = useMemo(() => urlPublicaAnexoMensagemCanal(supabase, src), [src])
  const [urlAssinada, setUrlAssinada] = useState(/** @type {string | null} */ (null))
  const [tentouAssinada, setTentouAssinada] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duracao, setDuracao] = useState(0)
  const [progresso, setProgresso] = useState(0)
  const audioRef = useRef(/** @type {HTMLAudioElement | null} */ (null))
  const url = urlAssinada ?? urlPublica

  const onError = useCallback(() => {
    if (tentouAssinada) return
    setTentouAssinada(true)
    void (async () => {
      const signed = await resolverUrlAnexoMensagemCanal(supabase, src, { forceSigned: true })
      setUrlAssinada(signed)
    })()
  }, [src, tentouAssinada])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onLoaded = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuracao(el.duration)
    }
    const onTime = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setProgresso(el.currentTime / el.duration)
      }
    }
    const onEnded = () => {
      setPlaying(false)
      setProgresso(0)
    }
    const onPause = () => setPlaying(false)
    const onPlay = () => setPlaying(true)

    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('durationchange', onLoaded)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnded)
    el.addEventListener('pause', onPause)
    el.addEventListener('play', onPlay)

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('durationchange', onLoaded)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('play', onPlay)
    }
  }, [url])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [])

  const formatarTempo = (seg) => {
    if (!Number.isFinite(seg) || seg < 0) return '0:00'
    const s = Math.floor(seg)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2, '0')}`
  }

  const tempoLabel = playing
    ? formatarTempo((duracao || 0) * progresso)
    : formatarTempo(duracao)

  const btnClass = isOwn
    ? 'bg-white/20 text-white hover:bg-white/30'
    : 'bg-[#0097b2]/15 text-[#0097b2] hover:bg-[#0097b2]/25'

  const barTrack = isOwn ? 'bg-white/25' : 'bg-gray-300'
  const barFill = isOwn ? 'bg-white' : 'bg-[#0097b2]'
  const timeClass = isOwn ? 'text-white/80' : 'text-gray-500'

  return (
    <div className="flex min-w-[10rem] items-center gap-2">
      <audio ref={audioRef} src={url} preload="metadata" onError={onError} className="hidden" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          togglePlay()
        }}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${btnClass}`}
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4 pl-0.5" aria-hidden />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className={`h-1 w-full overflow-hidden rounded-full ${barTrack}`}>
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${barFill}`}
            style={{ width: `${Math.min(100, Math.max(0, progresso * 100))}%` }}
          />
        </div>
        <span className={`text-[10px] tabular-nums ${timeClass}`}>{tempoLabel}</span>
      </div>
    </div>
  )
}
