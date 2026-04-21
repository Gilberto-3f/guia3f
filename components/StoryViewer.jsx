'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Heart, Link2, Play, Volume2, VolumeX, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchFotoPerfilUsuario,
  fetchNomeUsuarioParaStory,
  visualizadoPorEmails,
} from '@/lib/feed-autor'
import AvatarImage from '@/components/AvatarImage'
import StoryCanvas from '@/components/StoryCanvas'

const STORY_VIEW_MS = 15000
const SWIPE_DOWN_PX = 96

/**
 * @param {{ usuario_id?: string } | string | null | undefined} entry
 */
function entryUsuarioId(entry) {
  if (entry == null) return null
  if (typeof entry === 'string') return entry.trim() || null
  if (typeof entry === 'object' && 'usuario_id' in entry && entry.usuario_id != null) return String(entry.usuario_id)
  return null
}

/**
 * @param {unknown} raw
 * @returns {{ usuario_id: string, created_at?: string }[]}
 */
function parseCurtidasStory(raw) {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    const uid = entryUsuarioId(item)
    if (uid) {
      const created_at =
        typeof item === 'object' && item && 'created_at' in item && item.created_at != null ? String(item.created_at) : undefined
      out.push({ usuario_id: uid, created_at })
    }
  }
  return out
}

/**
 * @param {{
 *   story: {
 *     id: string
 *     tipo?: string
 *     conteudo_url: string
 *     texto_sobreposto: {
 *       texto?: string | null
 *       posicao_x?: number
 *       posicao_y?: number
 *       link_posicao_x?: number
 *       link_posicao_y?: number
 *       fundo_scale?: number
 *       fundo_pan_x_pct?: number
 *       fundo_pan_y_pct?: number
 *       texto_scale?: number
 *     } | null
 *     link: string | null
 *     duracao_segundos?: number | null
 *     autorUsuarioId?: string | null
 *     curtidas?: unknown
 *     visualizado_por?: unknown
 *   } | null
 *   userEmail: string | null
 *   meuUsuarioId: string | null
 *   onFechar: () => void
 *   onVisualizado?: () => void
 *   storyQueueLength?: number
 *   storyQueueIndex?: number
 *   onIrAnterior?: () => void
 *   onIrProximo?: () => void
 *   /** Se definido, o temporizador chama isto em vez de fechar o modal ao terminar (ex.: próximo story). */
 *   onTimerFim?: () => void
 *   /** Incrementar para reiniciar o temporizador no mesmo `story.id` (ex.: único story em loop). */
 *   timerPlaybackKey?: number
 * }} props
 */
export default function StoryViewer({
  story,
  userEmail,
  meuUsuarioId = null,
  onFechar,
  onVisualizado,
  storyQueueLength = 1,
  storyQueueIndex = 0,
  onIrAnterior,
  onIrProximo,
  onTimerFim,
  timerPlaybackKey = 0,
}) {
  const videoRef = useRef(/** @type {HTMLVideoElement | null} */ (null))
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const swipeRef = useRef(/** @type {{ y0: number, t0: number } | null} */ (null))
  const timerStartRef = useRef(/** @type {number | null} */ (null))
  const rafRef = useRef(/** @type {number | null} */ (null))
  /** Dedo a segurar: temporizador congelado até `pointerup`. */
  const holdPausedRef = useRef(false)
  const frozenElapsedRef = useRef(0)
  const onTimerFimRef = useRef(onTimerFim)
  const onFecharRef = useRef(onFechar)
  const playingRef = useRef(true)

  const [muted, setMuted] = useState(true)
  const [videoProgress, setVideoProgress] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [fotoAutor, setFotoAutor] = useState(/** @type {string | null} */ (null))
  const [rotuloAutor, setRotuloAutor] = useState(/** @type {string | null} */ (null))
  const [barraProgresso, setBarraProgresso] = useState(0)
  const [curtidasLista, setCurtidasLista] = useState(/** @type {{ usuario_id: string, created_at?: string }[]} */ ([]))
  const [curtirBusy, setCurtirBusy] = useState(false)
  const [modalInsights, setModalInsights] = useState(false)
  const [curtidasInsights, setCurtidasInsights] = useState(
    /** @type {{ usuario_id: string, rotulo: string, foto: string | null }[]} */ ([])
  )
  const [carregandoInsights, setCarregandoInsights] = useState(false)

  const uid = meuUsuarioId != null && meuUsuarioId !== '' ? String(meuUsuarioId) : null
  const curtiu = uid ? curtidasLista.some((c) => c.usuario_id === uid) : false

  useEffect(() => {
    onTimerFimRef.current = onTimerFim
    onFecharRef.current = onFechar
  }, [onTimerFim, onFechar])

  useEffect(() => {
    if (!story?.id || !userEmail) return
    void (async () => {
      const { error } = await supabase.rpc('append_story_viewer', { sid: story.id, viewer_email: userEmail })
      if (!error) onVisualizado?.()
    })()
  }, [story?.id, userEmail, onVisualizado])

  useEffect(() => {
    setCurtidasLista(parseCurtidasStory(story?.curtidas))
  }, [story?.curtidas, story?.id])

  useEffect(() => {
    if (!modalInsights || !story?.id) {
      if (!modalInsights) setCurtidasInsights([])
      return
    }
    let cancel = false
    setCarregandoInsights(true)
    const ids = [...new Set(curtidasLista.map((c) => c.usuario_id).filter(Boolean))]
    void (async () => {
      const rows = await Promise.all(
        ids.map(async (usuario_id) => {
          let rotulo = await fetchNomeUsuarioParaStory(supabase, usuario_id)
          if (rotulo) rotulo = rotulo.startsWith('@') ? rotulo : `@${rotulo.replace(/^@/, '')}`
          else {
            const { data: emp } = await supabase
              .from('empresas')
              .select('nome_fantasia')
              .eq('usuario_id', usuario_id)
              .maybeSingle()
            rotulo = emp?.nome_fantasia != null ? String(emp.nome_fantasia).trim() : 'Usuário'
          }
          const foto = await fetchFotoPerfilUsuario(supabase, usuario_id)
          return { usuario_id, rotulo, foto }
        })
      )
      if (cancel) return
      setCurtidasInsights(rows)
      setCarregandoInsights(false)
    })()
    return () => {
      cancel = true
    }
  }, [modalInsights, story?.id, curtidasLista])

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    const v = videoRef.current
    if (!v || String(story?.tipo) !== 'video') return
    void v.play().catch(() => setPlaying(false))
  }, [story?.tipo, story?.conteudo_url])

  useEffect(() => {
    const v = videoRef.current
    if (v) v.muted = muted
  }, [muted])

  const autorId = story?.autorUsuarioId != null && story.autorUsuarioId !== '' ? String(story.autorUsuarioId) : null

  useEffect(() => {
    if (!autorId) {
      setFotoAutor(null)
      return
    }
    let ativo = true
    void fetchFotoPerfilUsuario(supabase, autorId).then((url) => {
      if (ativo) setFotoAutor(url)
    })
    return () => {
      ativo = false
    }
  }, [autorId])

  useEffect(() => {
    if (!autorId) {
      setRotuloAutor(null)
      return
    }
    let ativo = true
    void (async () => {
      const handle = await fetchNomeUsuarioParaStory(supabase, autorId)
      if (!ativo) return
      if (handle) {
        const h = handle.trim()
        setRotuloAutor(h.startsWith('@') ? h : `@${h.replace(/^@/, '')}`)
        return
      }
      const { data: emp } = await supabase.from('empresas').select('nome_fantasia').eq('usuario_id', autorId).maybeSingle()
      if (!ativo) return
      const nf = emp?.nome_fantasia != null ? String(emp.nome_fantasia).trim() : ''
      setRotuloAutor(nf || 'Empresa')
    })()
    return () => {
      ativo = false
    }
  }, [autorId])

  const isVideo = String(story?.tipo ?? '') === 'video'
  const duracaoStoryMs =
    isVideo && story?.duracao_segundos != null && Number(story.duracao_segundos) > 0
      ? Math.min(STORY_VIEW_MS, Number(story.duracao_segundos) * 1000)
      : STORY_VIEW_MS

  const fecharTimer = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    timerStartRef.current = null
    holdPausedRef.current = false
  }, [])

  const scheduleTimerTick = useCallback(() => {
    const tick = () => {
      const t0 = timerStartRef.current
      if (t0 == null) return
      const elapsed = performance.now() - t0
      const p = Math.min(100, (elapsed / duracaoStoryMs) * 100)
      setBarraProgresso(p)
      if (elapsed >= duracaoStoryMs) {
        fecharTimer()
        const f = onTimerFimRef.current
        if (typeof f === 'function') f()
        else onFecharRef.current()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [duracaoStoryMs, fecharTimer])

  useEffect(() => {
    if (!story?.id) return
    holdPausedRef.current = false
    timerStartRef.current = performance.now()
    setBarraProgresso(0)
    scheduleTimerTick()
    return () => {
      fecharTimer()
    }
  }, [story?.id, duracaoStoryMs, timerPlaybackKey, scheduleTimerTick, fecharTimer])

  const pausarPorSegurar = useCallback(() => {
    if (holdPausedRef.current) return
    const t0 = timerStartRef.current
    if (t0 == null) return
    holdPausedRef.current = true
    frozenElapsedRef.current = performance.now() - t0
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const v = videoRef.current
    if (v && isVideo && !v.paused) v.pause()
  }, [isVideo])

  const retomarAposSoltar = useCallback(() => {
    if (!holdPausedRef.current) return
    holdPausedRef.current = false
    timerStartRef.current = performance.now() - frozenElapsedRef.current
    scheduleTimerTick()
    const v = videoRef.current
    if (v && isVideo && playingRef.current) void v.play().catch(() => setPlaying(false))
  }, [isVideo, scheduleTimerTick])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      const target = /** @type {HTMLElement | null} */ (e.target)
      if (target?.closest?.('[data-story-footer]')) return
      if (target?.closest?.('a[href]')) return
      swipeRef.current = { y0: t.clientY, t0: performance.now() }
    }

    const onTouchEnd = (e) => {
      const s = swipeRef.current
      swipeRef.current = null
      if (!s || e.changedTouches.length === 0) return
      const y = e.changedTouches[0].clientY
      const dy = y - s.y0
      if (dy > SWIPE_DOWN_PX) onFechar()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onFechar])

  const toggleCurtida = async () => {
    if (!story?.id || !uid || curtirBusy) return
    setCurtirBusy(true)
    try {
      const { data, error } = await supabase.rpc('toggle_story_curtida', { p_story_id: story.id })
      if (error) {
        console.error(error)
        return
      }
      const row = data && typeof data === 'object' && !Array.isArray(data) ? /** @type {Record<string, unknown>} */ (data) : null
      const rawC = row?.curtidas
      if (rawC != null) setCurtidasLista(parseCurtidasStory(rawC))
      else if (row?.liked) setCurtidasLista((prev) => (prev.some((c) => c.usuario_id === uid) ? prev : [...prev, { usuario_id: uid }]))
      else setCurtidasLista((prev) => prev.filter((c) => c.usuario_id !== uid))
    } finally {
      setCurtirBusy(false)
    }
  }

  if (!story) return null

  const tx = story.texto_sobreposto && typeof story.texto_sobreposto === 'object' && !Array.isArray(story.texto_sobreposto)
    ? /** @type {{ texto?: string | null, posicao_x?: number, posicao_y?: number, link_posicao_x?: number, link_posicao_y?: number, fundo_scale?: number, fundo_pan_x_pct?: number, fundo_pan_y_pct?: number, texto_scale?: number }} */ (
        story.texto_sobreposto
      )
    : null
  const px = typeof tx?.posicao_x === 'number' ? tx.posicao_x : 50
  const py = typeof tx?.posicao_y === 'number' ? tx.posicao_y : 70
  const linkX = typeof tx?.link_posicao_x === 'number' ? tx.link_posicao_x : 50
  const linkY = typeof tx?.link_posicao_y === 'number' ? tx.link_posicao_y : 86
  const fundo = {
    scale: typeof tx?.fundo_scale === 'number' ? tx.fundo_scale : 1,
    pan_x_pct: typeof tx?.fundo_pan_x_pct === 'number' ? tx.fundo_pan_x_pct : 0,
    pan_y_pct: typeof tx?.fundo_pan_y_pct === 'number' ? tx.fundo_pan_y_pct : 0,
  }
  const legendaStr = tx?.texto != null ? String(tx.texto).trim() : ''
  const linkStr = story.link != null ? String(story.link).trim() : ''
  const textoScale = typeof tx?.texto_scale === 'number' && Number.isFinite(tx.texto_scale) ? tx.texto_scale : 1
  const souAutor = Boolean(uid && autorId && uid === autorId)
  const emailsVisualizacao = visualizadoPorEmails(story.visualizado_por)

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v || !v.duration) return
    setVideoProgress((v.currentTime / v.duration) * 100)
  }

  const headerLeft = autorId ? (
    <Link
      href={`/perfil/${autorId}`}
      className="flex min-w-0 max-w-[78vw] items-center gap-2 py-1 text-white"
    >
      <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/25 ring-2 ring-white/30">
        {fotoAutor ? (
          <AvatarImage src={fotoAutor} alt="" width={36} height={36} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-white/80">?</span>
        )}
      </span>
      <span className="truncate text-sm font-semibold tracking-tight drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
        {rotuloAutor ?? '…'}
      </span>
    </Link>
  ) : (
    <span />
  )

  const headerExtras = isVideo ? (
    <button
      type="button"
      onClick={() => setMuted((m) => !m)}
      className="rounded-full bg-black/35 p-2 text-white backdrop-blur-sm"
      aria-label={muted ? 'Ativar som' : 'Silenciar'}
    >
      {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
    </button>
  ) : null

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 pt-[max(0.35rem,env(safe-area-inset-top))]"
        aria-hidden
      >
        {storyQueueLength <= 1 ? (
          <div className="h-0.5 w-full bg-white/25">
            <div className="h-full bg-white" style={{ width: `${barraProgresso}%` }} />
          </div>
        ) : (
          <div className="flex gap-1 px-1.5">
            {Array.from({ length: storyQueueLength }).map((_, i) => (
              <div key={i} className="h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                  style={{
                    width:
                      i < storyQueueIndex ? '100%' : i === storyQueueIndex ? `${barraProgresso}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {!isVideo ? (
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0">
            <StoryCanvas
              layout="viewerCover"
              mediaSrc={story.conteudo_url}
              legenda={legendaStr}
              posicaoLegenda={{ x: px, y: py }}
              linkUrl={linkStr}
              posicaoLink={{ x: linkX, y: linkY }}
              fundo={fundo}
              textoScale={textoScale}
              linkHref={linkStr || null}
            />
          </div>
          {typeof onIrAnterior === 'function' ? (
            <button
              type="button"
              className="absolute bottom-32 left-0 top-20 z-[14] w-[min(28%,140px)] max-w-[140px] cursor-pointer bg-transparent"
              aria-label="Story anterior"
              onClick={() => onIrAnterior()}
            />
          ) : null}
          {typeof onIrProximo === 'function' ? (
            <button
              type="button"
              className="absolute bottom-32 right-0 top-20 z-[14] w-[min(28%,140px)] max-w-[140px] cursor-pointer bg-transparent"
              aria-label="Story seguinte"
              onClick={() => onIrProximo()}
            />
          ) : null}
          <div
            className="absolute inset-x-[min(28%,140px)] top-20 z-[13] touch-none bg-transparent"
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return
              e.currentTarget.setPointerCapture(e.pointerId)
              pausarPorSegurar()
            }}
            onPointerUp={(e) => {
              retomarAposSoltar()
              try {
                e.currentTarget.releasePointerCapture(e.pointerId)
              } catch {
                /* já libertado */
              }
            }}
            onPointerCancel={(e) => {
              retomarAposSoltar()
              try {
                e.currentTarget.releasePointerCapture(e.pointerId)
              } catch {
                /* já libertado */
              }
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 to-transparent pt-[max(0.75rem,env(safe-area-inset-top))] pb-10">
            <div className="pointer-events-auto flex items-start justify-between gap-2 px-3">
              <div className="min-w-0">{headerLeft}</div>
              <div className="flex shrink-0 items-center gap-2 pr-1">{headerExtras}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 to-transparent pt-[max(0.75rem,env(safe-area-inset-top))] pb-12">
            <div className="pointer-events-auto flex items-start justify-between gap-2 px-3">
              <div className="min-w-0">{headerLeft}</div>
              <div className="flex shrink-0 items-center gap-2 pr-1">{headerExtras}</div>
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            {typeof onIrAnterior === 'function' ? (
              <button
                type="button"
                className="absolute bottom-32 left-0 top-24 z-[14] w-[min(28%,140px)] max-w-[140px] cursor-pointer bg-transparent"
                aria-label="Story anterior"
                onClick={() => onIrAnterior()}
              />
            ) : null}
            {typeof onIrProximo === 'function' ? (
              <button
                type="button"
                className="absolute bottom-32 right-0 top-24 z-[14] w-[min(28%,140px)] max-w-[140px] cursor-pointer bg-transparent"
                aria-label="Story seguinte"
                onClick={() => onIrProximo()}
              />
            ) : null}
            <div
              className="absolute inset-x-[min(28%,140px)] top-24 z-[13] touch-none bg-transparent"
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return
                e.currentTarget.setPointerCapture(e.pointerId)
                pausarPorSegurar()
              }}
              onPointerUp={(e) => {
                retomarAposSoltar()
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                } catch {
                  /* já libertado */
                }
              }}
              onPointerCancel={(e) => {
                retomarAposSoltar()
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                } catch {
                  /* já libertado */
                }
              }}
              aria-hidden
            />
            <video
              ref={videoRef}
              src={story.conteudo_url}
              className="absolute inset-0 h-full w-full object-cover"
              muted={muted}
              playsInline
              loop
              onTimeUpdate={onTimeUpdate}
              onClick={() => togglePlay()}
            />
            {!playing ? (
              <button
                type="button"
                onClick={() => togglePlay()}
                className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
                aria-label="Reproduzir"
              >
                <Play size={36} fill="currentColor" className="ml-1" />
              </button>
            ) : null}

            {tx?.texto ? (
              <p
                className="absolute z-10 max-w-[90%] rounded bg-black/50 px-2 py-1 text-sm text-white"
                style={{ left: `${px}%`, top: `${py}%`, transform: 'translate(-50%, -50%)' }}
              >
                {tx.texto}
              </p>
            ) : null}
            {story.link ? (
              <a
                href={story.link}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-24 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm"
              >
                <Link2 size={18} strokeWidth={2} aria-hidden className="text-gray-700" />
                Abrir link
              </a>
            ) : null}

            <div className="absolute bottom-16 left-0 right-0 z-10 h-0.5 bg-white/20 px-3">
              <div className="h-full bg-[#0097b2]" style={{ width: `${videoProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <footer
        data-story-footer
        className={`pointer-events-auto z-40 flex w-full items-center border-t border-white/10 bg-black/75 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 ${uid ? 'justify-end' : 'justify-center'}`}
      >
        {souAutor ? (
          <button
            type="button"
            onClick={() => setModalInsights(true)}
            className="flex flex-col items-center gap-1 rounded-full p-2 text-white transition hover:bg-white/10"
            aria-label="Ver curtidas e visualizações"
          >
            <ClipboardList size={32} strokeWidth={2} />
            <span className="text-[11px] font-medium text-white/90">
              {curtidasLista.length} · {emailsVisualizacao.length}
            </span>
          </button>
        ) : uid ? (
          <button
            type="button"
            disabled={curtirBusy}
            onClick={() => void toggleCurtida()}
            className="flex flex-col items-center gap-1 rounded-full p-2 text-white transition hover:bg-white/10 disabled:opacity-50"
            aria-label={curtiu ? 'Remover curtida' : 'Curtir story'}
          >
            <Heart
              size={32}
              strokeWidth={2}
              className={curtiu ? 'fill-red-500 text-red-500' : ''}
              fill={curtiu ? 'currentColor' : 'none'}
            />
            <span className="text-[11px] font-medium text-white/90">{curtidasLista.length}</span>
          </button>
        ) : (
          <p className="text-center text-xs text-white/70">Inicie sessão para curtir</p>
        )}
      </footer>

      {modalInsights ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Fechar"
            onClick={() => setModalInsights(false)}
          />
          <div className="relative z-[1] flex max-h-[min(72dvh,560px)] w-full max-w-md flex-col rounded-t-2xl border border-white/10 bg-zinc-900 shadow-2xl sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Curtidas e visualizações</h2>
              <button
                type="button"
                onClick={() => setModalInsights(false)}
                className="rounded-full p-2 text-white/80 transition hover:bg-white/10"
                aria-label="Fechar"
              >
                <X size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">Curtiram</p>
              {carregandoInsights ? (
                <p className="py-4 text-center text-sm text-white/60">A carregar…</p>
              ) : curtidasInsights.length === 0 ? (
                <p className="py-2 text-sm text-white/60">Ainda ninguém curtiu.</p>
              ) : (
                <ul className="space-y-2 pb-4">
                  {curtidasInsights.map((row) => (
                    <li key={row.usuario_id}>
                      <Link
                        href={`/perfil/${row.usuario_id}`}
                        className="flex items-center gap-3 rounded-lg py-1.5 transition hover:bg-white/5"
                        onClick={() => setModalInsights(false)}
                      >
                        <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/15">
                          {row.foto ? (
                            <AvatarImage src={row.foto} alt="" width={40} height={40} className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-xs text-white/60">?</span>
                          )}
                        </span>
                        <span className="min-w-0 truncate text-sm font-medium text-white">{row.rotulo}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mb-2 mt-2 text-xs font-medium uppercase tracking-wide text-white/50">Visualizaram</p>
              {emailsVisualizacao.length === 0 ? (
                <p className="py-2 text-sm text-white/60">Ainda sem registos de visualização.</p>
              ) : (
                <ul className="space-y-1.5">
                  {emailsVisualizacao.map((email) => (
                    <li key={email} className="truncate text-sm text-white/90">
                      {email}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
