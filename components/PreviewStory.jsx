'use client'

import Image from 'next/image'

/**
 * @param {{
 *   mediaSrc: string
 *   mediaKind: 'image' | 'video'
 *   legenda: string
 *   posicao: { x: number, y: number }
 *   linkUrl: string
 *   onVoltar: () => void
 *   onPublicar: () => void
 *   publicando?: boolean
 * }} props
 */
export default function PreviewStory({ mediaSrc, mediaKind, legenda, posicao, linkUrl, onVoltar, onPublicar, publicando = false }) {
  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[9/16] max-h-[70vh] w-full max-w-sm overflow-hidden rounded-xl bg-black">
        {mediaKind === 'video' ? (
          <video src={mediaSrc} className="absolute inset-0 h-full w-full object-cover" muted playsInline controls loop preload="auto" />
        ) : (
          <Image src={mediaSrc} alt="" fill className="object-cover" unoptimized />
        )}
        {legenda ? (
          <div
            className="absolute max-w-[90%] rounded bg-black/45 px-2 py-1 text-sm font-medium text-white"
            style={{ left: `${posicao.x}%`, top: `${posicao.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {legenda}
          </div>
        ) : null}
        {linkUrl ? (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-[#0097b2]">🔗 Link anexado</span>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onVoltar} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium">
          Voltar
        </button>
        <button
          type="button"
          disabled={publicando}
          onClick={onPublicar}
          className="flex-1 rounded-lg bg-[#0097b2] py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {publicando ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </div>
  )
}
