'use client'

import { useState } from 'react'
import { CheckCircle, Images, Link2, Type } from 'lucide-react'
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
 *   onTrocarFoto: () => void
 *   onPublicar: () => void
 *   publicando?: boolean
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
  onTrocarFoto,
  onPublicar,
  publicando = false,
}) {
  const [painel, setPainel] = useState(/** @type {null | 'legenda' | 'link'} */ (null))

  if (mediaKind !== 'image') {
    return <p className="text-center text-sm text-gray-500">Apenas imagem neste fluxo.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center px-0 pb-0 pt-0">
        <StoryCanvas
          layout="editorFill"
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
          onEditarLegenda={() => setPainel('legenda')}
          onEditarLink={() => setPainel('link')}
        />
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-black/70 px-1 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:gap-1">
          <button
            type="button"
            disabled={publicando}
            onClick={() => setPainel('legenda')}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[#0097b2] transition hover:bg-white/10 disabled:opacity-45 sm:py-2"
          >
            <Type size={22} strokeWidth={2} aria-hidden className="sm:h-[26px] sm:w-[26px]" />
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-xs">Legenda</span>
          </button>
          <button
            type="button"
            disabled={publicando}
            onClick={() => setPainel('link')}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[#0097b2] transition hover:bg-white/10 disabled:opacity-45 sm:py-2"
          >
            <Link2 size={22} strokeWidth={2} aria-hidden className="sm:h-[26px] sm:w-[26px]" />
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-xs">Link</span>
          </button>
          <button
            type="button"
            disabled={publicando}
            onClick={onTrocarFoto}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[#0097b2] transition hover:bg-white/10 disabled:opacity-45 sm:py-2"
          >
            <Images size={22} strokeWidth={2} aria-hidden className="sm:h-[26px] sm:w-[26px]" />
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-xs">Trocar foto</span>
          </button>
          <button
            type="button"
            disabled={publicando}
            onClick={() => void onPublicar()}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-green-500 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45 sm:py-2"
          >
            <CheckCircle size={22} strokeWidth={2} aria-hidden className="sm:h-[26px] sm:w-[26px]" />
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-xs">
              {publicando ? 'Enviando…' : 'Publicar'}
            </span>
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
