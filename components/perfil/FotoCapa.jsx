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
 * }} props
 */
export default function FotoCapa({ src, nomeFallback = '', onOpenMenu, mostrarMenu = true }) {
  const capaSrc = src && urlMidiaValida(src) ? normalizarUrlMidiaSupabase(src) : ''

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
