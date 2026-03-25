'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Play, Volume2, VolumeX, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * @param {{
 *   story: {
 *     id: string
 *     tipo?: string
 *     conteudo_url: string
 *     texto_sobreposto: { texto?: string | null, posicao_x?: number, posicao_y?: number } | null
 *     link: string | null
 *     duracao_segundos?: number | null
 *   } | null
 *   userEmail: string | null
 *   onFechar: () => void
 * }} props
 */
export default function StoryViewer({ story, userEmail, onFechar }) {
  const videoRef = useRef(/** @type {HTMLVideoElement | null} */ (null))
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!story?.id || !userEmail) return
    void supabase.rpc('append_story_viewer', { sid: story.id, viewer_email: userEmail })
  }, [story?.id, userEmail])

  useEffect(() => {
    const v = videoRef.current
    if (!v || String(story?.tipo) !== 'video') return
    void v.play().catch(() => setPlaying(false))
  }, [story?.tipo, story?.conteudo_url])

  useEffect(() => {
    const v = videoRef.current
    if (v) v.muted = muted
  }, [muted])

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
      <div className="flex items-start justify-end gap-2 p-3">
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
