'use client'

import MediaFillImage from '@/components/MediaFillImage'
import BotaoAbrirMenuLateral from '@/components/perfil/BotaoAbrirMenuLateral'
import { normalizarUrlMidiaSupabase, urlMidiaValida } from '@/lib/imagemPublica'

/**
 * @param {{
 *   src: string | null
 *   nomeFallback?: string
 *   onOpenMenu?: () => void
 *   mostrarMenu?: boolean
 *   variante?: 'capa' | 'avatar'
 * }} props
 */
export default function FotoCapa({
  src,
  nomeFallback = '',
  onOpenMenu,
  mostrarMenu = true,
  variante = 'capa',
}) {
  const capaSrc = src && urlMidiaValida(src) ? normalizarUrlMidiaSupabase(src) : ''

  if (variante === 'avatar') {
    return (
      <div className="flex justify-center px-4 pt-5">
        <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-[3px] border-[#0097b2] bg-gradient-to-br from-[#0097b2]/40 to-[#001f3f]/60 shadow-sm">
          {capaSrc ? (
            <MediaFillImage src={capaSrc} alt="" sizes="112px" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/60">
              {nomeFallback.charAt(0) || '?'}
            </div>
          )}
        </div>
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
