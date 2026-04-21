'use client'

import StoryCanvas from '@/components/StoryCanvas'

/**
 * @param {{
 *   mediaSrc: string
 *   mediaKind: 'image' | 'video'
 *   legenda: string
 *   posicao: { x: number, y: number }
 *   posicaoLink: { x: number, y: number }
 *   fundo: { scale: number, pan_x_pct: number, pan_y_pct: number }
 *   linkUrl: string
 *   onVoltar: () => void
 *   onPublicar: () => void
 *   publicando?: boolean
 * }} props
 */
export default function PreviewStory({
  mediaSrc,
  mediaKind,
  legenda,
  posicao,
  posicaoLink,
  fundo,
  linkUrl,
  onVoltar,
  onPublicar,
  publicando = false,
}) {
  if (mediaKind !== 'image') {
    return <p className="text-center text-sm text-gray-500">Apenas imagem neste fluxo.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <StoryCanvas
          mediaSrc={mediaSrc}
          legenda={legenda.trim()}
          posicaoLegenda={posicao}
          linkUrl={linkUrl.trim()}
          posicaoLink={posicaoLink}
          fundo={fundo}
          linkHref={linkUrl.trim() || null}
        />
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
          {publicando ? 'Publicando...' : 'Confirmar publicação'}
        </button>
      </div>
    </div>
  )
}
