'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { resolverUrlAnexoMensagemCanal, urlPublicaAnexoMensagemCanal } from '@/lib/canalAnexoUrl'
import { navegadorPrefereAudioMp4 } from '@/lib/canalAudioGravacao'

/**
 * Duração gravada no envio: `#d=12.5` na URL do anexo.
 * @param {string} anexoUrl
 */
export function extrairDuracaoAudioAnexo(anexoUrl) {
  const raw = String(anexoUrl ?? '')
  if (!raw) return 0
  try {
    const hash = raw.includes('#') ? raw.slice(raw.indexOf('#') + 1) : ''
    const fromHash = /(?:^|&)d=([\d.]+)/.exec(hash)
    if (fromHash) {
      const n = Number(fromHash[1])
      if (Number.isFinite(n) && n > 0) return n
    }
    const fromQuery = /[?&]d=([\d.]+)/.exec(raw)
    if (fromQuery) {
      const n = Number(fromQuery[1])
      if (Number.isFinite(n) && n > 0) return n
    }
  } catch {
    /* ignore */
  }
  return 0
}

/**
 * @param {string} url
 * @param {number} duracaoSec
 */
export function anexarDuracaoAudioUrl(url, duracaoSec) {
  const base = String(url ?? '').split('#')[0]
  if (!base || !Number.isFinite(duracaoSec) || duracaoSec <= 0) return base
  return `${base}#d=${duracaoSec.toFixed(1)}`
}

/**
 * @param {HTMLAudioElement} el
 */
function lerDuracaoMedia(el) {
  if (Number.isFinite(el.duration) && el.duration > 0) return el.duration
  try {
    if (el.seekable?.length > 0) {
      const end = el.seekable.end(el.seekable.length - 1)
      if (Number.isFinite(end) && end > 0) return end
    }
  } catch {
    /* ignore */
  }
  try {
    if (el.buffered?.length > 0) {
      const end = el.buffered.end(el.buffered.length - 1)
      if (Number.isFinite(end) && end > 0) return end
    }
  } catch {
    /* ignore */
  }
  return 0
}

/**
 * Player de mensagem de áudio no canal (toque em play para ouvir).
 * @param {{ src: string; isOwn?: boolean; durationSec?: number }} props
 */
export default function CanalMensagemAudio({ src, isOwn = false, durationSec }) {
  const duracaoEnviada = useMemo(() => {
    const prop = Number(durationSec)
    if (Number.isFinite(prop) && prop > 0) return prop
    return extrairDuracaoAudioAnexo(src)
  }, [src, durationSec])

  const urlPublica = useMemo(() => {
    const limpa = String(src ?? '').split('#')[0]
    return urlPublicaAnexoMensagemCanal(supabase, limpa)
  }, [src])
  const [url, setUrl] = useState(urlPublica)
  const [faseUrl, setFaseUrl] = useState(/** @type {'publica' | 'assinada'} */ ('publica'))
  const [playing, setPlaying] = useState(false)
  const [duracao, setDuracao] = useState(duracaoEnviada)
  const [progresso, setProgresso] = useState(0)
  const [erroPlayback, setErroPlayback] = useState(false)
  const audioRef = useRef(/** @type {HTMLAudioElement | null} */ (null))
  const rafRef = useRef(0)
  const duracaoRef = useRef(duracaoEnviada)

  useEffect(() => {
    duracaoRef.current = duracao
  }, [duracao])

  useEffect(() => {
    setUrl(urlPublica)
    setFaseUrl('publica')
    setPlaying(false)
    setProgresso(0)
    setDuracao(duracaoEnviada)
    duracaoRef.current = duracaoEnviada
    setErroPlayback(false)
  }, [urlPublica, duracaoEnviada])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.load()
  }, [url])

  const tentarUrlAssinada = useCallback(async () => {
    const limpa = String(src ?? '').split('#')[0]
    const signed = await resolverUrlAnexoMensagemCanal(supabase, limpa, { forceSigned: true })
    setUrl(signed)
    setFaseUrl('assinada')
  }, [src])

  const onError = useCallback(() => {
    if (faseUrl === 'publica') {
      void tentarUrlAssinada()
      return
    }
    setErroPlayback(true)
  }, [faseUrl, tentarUrlAssinada])

  const atualizarProgresso = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    const mediaDur = lerDuracaoMedia(el)
    if (mediaDur > 0 && mediaDur !== duracaoRef.current) {
      duracaoRef.current = mediaDur
      setDuracao(mediaDur)
    }
    const total = duracaoRef.current > 0 ? duracaoRef.current : mediaDur
    if (total > 0) {
      setProgresso(Math.min(1, Math.max(0, el.currentTime / total)))
    } else if (el.currentTime > 0) {
      // Sem duração conhecida: avança a barra de forma aproximada até descobrir.
      setProgresso((p) => Math.min(0.95, Math.max(p, el.currentTime / Math.max(el.currentTime + 1, 1))))
    }
  }, [])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onLoaded = () => {
      setErroPlayback(false)
      const d = lerDuracaoMedia(el)
      if (d > 0) {
        duracaoRef.current = d
        setDuracao(d)
      } else if (duracaoEnviada > 0) {
        duracaoRef.current = duracaoEnviada
        setDuracao(duracaoEnviada)
      }
    }
    const onEnded = () => {
      setPlaying(false)
      setProgresso(1)
      window.setTimeout(() => setProgresso(0), 200)
    }
    const onPause = () => setPlaying(false)
    const onPlay = () => setPlaying(true)

    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('durationchange', onLoaded)
    el.addEventListener('ended', onEnded)
    el.addEventListener('pause', onPause)
    el.addEventListener('play', onPlay)

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('durationchange', onLoaded)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('play', onPlay)
    }
  }, [url, duracaoEnviada])

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      return
    }
    const tick = () => {
      atualizarProgresso()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [playing, atualizarProgresso])

  const togglePlay = useCallback(async () => {
    const el = audioRef.current
    if (!el || erroPlayback) return
    if (el.paused) {
      try {
        await el.play()
      } catch {
        if (faseUrl === 'publica') {
          await tentarUrlAssinada()
          try {
            await audioRef.current?.play()
          } catch {
            setErroPlayback(true)
          }
        } else {
          setErroPlayback(true)
        }
      }
    } else {
      el.pause()
    }
  }, [erroPlayback, faseUrl, tentarUrlAssinada])

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

  void isOwn

  const btnClass = 'bg-[#0097b2]/15 text-[#0097b2] hover:bg-[#0097b2]/25'
  const barTrack = 'bg-gray-300'
  const barFill = 'bg-[#0097b2]'
  const timeClass = 'text-gray-500'

  const avisoSafariWebm =
    erroPlayback && navegadorPrefereAudioMp4() && /\.webm/i.test(src)
      ? 'Áudio em formato não suportado neste aparelho'
      : erroPlayback
        ? 'Não foi possível reproduzir'
        : null

  return (
    <div className="flex min-w-[10rem] flex-col gap-1">
      <div className="flex items-center gap-2">
        <audio
          ref={audioRef}
          src={url}
          preload="auto"
          playsInline
          onError={onError}
          className="hidden"
        />
        <button
          type="button"
          disabled={Boolean(avisoSafariWebm)}
          onClick={(e) => {
            e.stopPropagation()
            void togglePlay()
          }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${btnClass} disabled:opacity-40`}
          aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4 pl-0.5" aria-hidden />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className={`h-1 w-full overflow-hidden rounded-full ${barTrack}`}>
            <div
              className={`h-full rounded-full ${barFill}`}
              style={{ width: `${Math.min(100, Math.max(0, progresso * 100))}%` }}
            />
          </div>
          <span className={`text-[10px] tabular-nums ${timeClass}`}>{tempoLabel}</span>
        </div>
      </div>
      {avisoSafariWebm ? (
        <span className="text-[10px] text-gray-500">{avisoSafariWebm}</span>
      ) : null}
    </div>
  )
}
