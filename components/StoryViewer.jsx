'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Play, Volume2, VolumeX, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchFotoPerfilUsuario, fetchNomeUsuarioParaStory } from '@/lib/feed-autor'
import AvatarImage from '@/components/AvatarImage'
import StoryCanvas from '@/components/StoryCanvas'

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
 *     } | null
 *     link: string | null
 *     duracao_segundos?: number | null
 *     autorUsuarioId?: string | null
 *   } | null
 *   userEmail: string | null
 *   onFechar: () => void
 *   onVisualizado?: () => void
 * }} props
 */
export default function StoryViewer({ story, userEmail, onFechar, onVisualizado }) {
  const videoRef = useRef(/** @type {HTMLVideoElement | null} */ (null))
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [fotoAutor, setFotoAutor] = useState(/** @type {string | null} */ (null))
  const [rotuloAutor, setRotuloAutor] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    if (!story?.id || !userEmail) return
    void (async () => {
      const { error } = await supabase.rpc('append_story_viewer', { sid: story.id, viewer_email: userEmail })
      if (!error) onVisualizado?.()
    })()
  }, [story?.id, userEmail, onVisualizado])

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

  if (!story) return null

  const isVideo = String(story.tipo ?? '') === 'video'
  const tx = story.texto_sobreposto && typeof story.texto_sobreposto === 'object' && !Array.isArray(story.texto_sobreposto)
    ? /** @type {{ texto?: string | null, posicao_x?: number, posicao_y?: number, link_posicao_x?: number, link_posicao_y?: number, fundo_scale?: number, fundo_pan_x_pct?: number, fundo_pan_y_pct?: number }} */ (
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
    setProgress((v.currentTime / v.duration) * 100)
  }

  const headerLeft = autorId ? (
    <Link
      href={`/perfil/${autorId}`}
      className="flex min-w-0 max-w-[72vw] items-center gap-2 py-1 text-white"
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

  const headerRight = (
    <div className="flex shrink-0 items-start gap-2">
      {isVideo ? (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="rounded-full bg-white/10 p-2 text-white"
          aria-label={muted ? 'Ativar som' : 'Silenciar'}
        >
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
      ) : null}
      <button type="button" onClick={onFechar} className="rounded-full bg-white/10 p-2 text-white" aria-label="Fechar">
        <X size={24} />
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {!isVideo ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="pointer-events-auto min-w-0">{headerLeft}</div>
            <div className="pointer-events-auto">{headerRight}</div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-6 pt-14">
            <StoryCanvas
              mediaSrc={story.conteudo_url}
              legenda={legendaStr}
              posicaoLegenda={{ x: px, y: py }}
              linkUrl={linkStr}
              posicaoLink={{ x: linkX, y: linkY }}
              fundo={fundo}
              linkHref={linkStr || null}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 p-3">
            {headerLeft}
            {headerRight}
          </div>
          <div className="relative min-h-0 flex-1">
            <video
              ref={videoRef}
              src={story.conteudo_url}
              className="absolute inset-0 h-full w-full object-contain"
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
                className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
                aria-label="Reproduzir"
              >
                <Play size={36} fill="currentColor" className="ml-1" />
              </button>
            ) : null}

            {tx?.texto ? (
              <p
                className="absolute max-w-[90%] rounded bg-black/50 px-2 py-1 text-sm text-white"
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
                className="absolute bottom-12 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-[#0097b2]"
              >
                Abrir link
              </a>
            ) : null}

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div className="h-full bg-[#0097b2]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
