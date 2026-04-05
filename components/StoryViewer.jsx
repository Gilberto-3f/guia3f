'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Play, Volume2, VolumeX, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchFotoPerfilUsuario } from '@/lib/feed-autor'
import AvatarImage from '@/components/AvatarImage'

/**
 * @param {{
 *   story: {
 *     id: string
 *     tipo?: string
 *     conteudo_url: string
 *     texto_sobreposto: { texto?: string | null, posicao_x?: number, posicao_y?: number } | null
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

  if (!story) return null

  const isVideo = String(story.tipo ?? '') === 'video'
  const tx = story.texto_sobreposto && typeof story.texto_sobreposto === 'object' && !Array.isArray(story.texto_sobreposto)
    ? /** @type {{ texto?: string | null, posicao_x?: number, posicao_y?: number }} */ (story.texto_sobreposto)
    : null
  const px = typeof tx?.posicao_x === 'number' ? tx.posicao_x : 50
  const py = typeof tx?.posicao_y === 'number' ? tx.posicao_y : 70

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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-start justify-between gap-2 p-3">
        {autorId ? (
          <Link
            href={`/perfil/${autorId}`}
            className="flex min-w-0 items-center gap-2 rounded-lg bg-white/10 py-1 pl-1 pr-3 text-white hover:bg-white/20"
          >
            <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/20">
              {fotoAutor ? (
                <AvatarImage src={fotoAutor} alt="" width={36} height={36} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs text-white/80">?</span>
              )}
            </span>
            <span className="truncate text-sm font-medium">Ver perfil</span>
          </Link>
        ) : (
          <span />
        )}
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
      </div>

      <div className="relative min-h-0 flex-1">
        {isVideo ? (
          <>
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
          </>
        ) : (
          <Image src={story.conteudo_url} alt="" fill className="object-contain" sizes="100vw" />
        )}

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

        {isVideo ? (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-[#0097b2]" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
