'use client'

import { useState } from 'react'
import { CheckCircle, Link2, Type } from 'lucide-react'
import StoryCanvas from '@/components/StoryCanvas'

/**
 * @param {{
 *   mediaSrc: string
 *   mediaKind: 'image' | 'video'
 *   legenda: string
 *   onLegendaChange: (s: string) => void
 *   posicao: { x: number, y: number }
 *   onPosicaoChange: (p: { x: number, y: number }) => void
 *   posicaoLink: { x: number, y: number }
 *   onPosicaoLinkChange: (p: { x: number, y: number }) => void
 *   fundo: { scale: number, pan_x_pct: number, pan_y_pct: number }
 *   onFundoChange: (f: { scale: number, pan_x_pct: number, pan_y_pct: number }) => void
 *   linkUrl: string
 *   onLinkChange: (s: string) => void
 *   onRevisar: () => void
 * }} props
 */
export default function EditorStory({
  mediaSrc,
  mediaKind,
  legenda,
  onLegendaChange,
  posicao,
  onPosicaoChange,
  posicaoLink,
  onPosicaoLinkChange,
  fundo,
  onFundoChange,
  linkUrl,
  onLinkChange,
  onRevisar,
}) {
  const [painel, setPainel] = useState(/** @type {null | 'legenda' | 'link'} */ (null))

  if (mediaKind !== 'image') {
    return <p className="text-center text-sm text-gray-500">Apenas imagem neste fluxo.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-900 sm:bg-gray-100">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 pb-2 pt-1">
        <p className="mb-1 hidden text-center text-[10px] text-white/60 sm:block">Proporção 9:16 (1080×1920)</p>
        <StoryCanvas
          mediaSrc={mediaSrc}
          legenda={legenda.trim()}
          posicaoLegenda={posicao}
          linkUrl={linkUrl.trim()}
          posicaoLink={posicaoLink}
          fundo={fundo}
          allowEditImage
          allowEditText
          allowEditLink={Boolean(linkUrl.trim())}
          onLegendaPos={onPosicaoChange}
          onLinkPos={onPosicaoLinkChange}
          onFundoChange={onFundoChange}
        />
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-black/55 px-2 py-3 backdrop-blur-md sm:border-gray-200 sm:bg-white/95">
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-2 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setPainel('legenda')}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[#0097b2] transition hover:bg-white/10 sm:hover:bg-gray-100"
          >
            <Type size={26} strokeWidth={2} aria-hidden />
            <span className="text-xs font-semibold">Legenda</span>
          </button>
          <button
            type="button"
            onClick={() => setPainel('link')}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[#0097b2] transition hover:bg-white/10 sm:hover:bg-gray-100"
          >
            <Link2 size={26} strokeWidth={2} aria-hidden />
            <span className="text-xs font-semibold">Link</span>
          </button>
          <button
            type="button"
            onClick={onRevisar}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-green-500 transition hover:bg-white/10 sm:hover:bg-gray-100"
          >
            <CheckCircle size={26} strokeWidth={2} aria-hidden />
            <span className="text-xs font-semibold">Publicar</span>
          </button>
        </div>
      </footer>

      {painel === 'legenda' ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50"
          aria-label="Fechar legenda"
          onClick={() => setPainel(null)}
        />
      ) : null}
      {painel === 'legenda' ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl sm:border-gray-200 sm:bg-white">
          <label className="mb-2 block text-xs font-medium text-white/80 sm:text-gray-600">Legenda (máx. 150)</label>
          <textarea
            value={legenda}
            maxLength={150}
            onChange={(e) => onLegendaChange(e.target.value)}
            rows={3}
            className="mb-3 w-full rounded-xl border border-white/20 bg-black/40 p-3 text-sm text-white placeholder:text-white/40 sm:border-gray-200 sm:bg-white sm:text-gray-900"
            placeholder="Escreva algo…"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setPainel(null)}
            className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      ) : null}

      {painel === 'link' ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50"
          aria-label="Fechar link"
          onClick={() => setPainel(null)}
        />
      ) : null}
      {painel === 'link' ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl sm:border-gray-200 sm:bg-white">
          <label className="mb-2 block text-xs font-medium text-white/80 sm:text-gray-600">Link opcional</label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder="https://"
            className="mb-3 w-full rounded-xl border border-white/20 bg-black/40 p-3 text-sm text-white placeholder:text-white/40 sm:border-gray-200 sm:bg-white sm:text-gray-900"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setPainel(null)}
            className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      ) : null}
    </div>
  )
}
