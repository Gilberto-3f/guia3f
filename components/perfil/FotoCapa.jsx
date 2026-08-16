'use client'

import MediaFillImage from '@/components/MediaFillImage'
import BotaoAbrirMenuLateral from '@/components/perfil/BotaoAbrirMenuLateral'
import { emailVisualizouStory, STORY_RING_GRADIENT } from '@/lib/feed-autor'
import { normalizarUrlMidiaSupabase, urlMidiaValida } from '@/lib/imagemPublica'

/**
 * @param {{
 *   src: string | null
 *   nomeFallback?: string
 *   onOpenMenu?: () => void
 *   mostrarMenu?: boolean
 *   variante?: 'capa' | 'avatar'
 *   storyAtivo?: { id?: string | null; visualizado_por?: unknown } | null
 *   userEmail?: string | null
 * }} props
 */
export default function FotoCapa({
  src,
  nomeFallback = '',
  onOpenMenu,
  mostrarMenu = true,
  variante = 'capa',
  storyAtivo = null,
  userEmail = null,
}) {
  const capaSrc = src && urlMidiaValida(src) ? normalizarUrlMidiaSupabase(src) : ''

  if (variante === 'avatar') {
    const temStory = Boolean(storyAtivo?.id)
    const storyVisto = temStory
      ? emailVisualizouStory(storyAtivo?.visualizado_por, userEmail)
      : true
    const avatar = (
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#0097b2]/40 to-[#001f3f]/60 shadow-sm">
        {capaSrc ? (
          <MediaFillImage src={capaSrc} alt="" sizes="112px" priority />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/60">
            {nomeFallback.charAt(0) || '?'}
          </div>
        )}
      </div>
    )

    return (
      <div className="flex justify-center px-4 pt-5">
        {temStory ? (
          <div
            className={`h-28 w-28 rounded-2xl p-[2px] ${storyVisto ? 'bg-gray-300' : ''}`}
            style={storyVisto ? undefined : { background: STORY_RING_GRADIENT }}
          >
            <div className="h-full w-full rounded-2xl bg-white p-[2px]">
              {avatar}
            </div>
          </div>
        ) : (
          <div className="h-28 w-28">{avatar}</div>
        )}
      </div>
    )
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-[#0097b2]/40 to-[#001f3f]/60">
      {capaSrc ? (
        <MediaFillImage src={capaSrc} alt="" sizes="100vw" priority />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-white/40">
          {nomeFallback.charAt(0) || '?'}
        </div>
      )}
      {mostrarMenu && onOpenMenu ? (
        <BotaoAbrirMenuLateral
          onClick={onOpenMenu}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/30 p-2 text-white"
          iconClassName="h-6 w-6 text-white"
        />
      ) : null}
    </div>
  )
}
