'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'

/**
 * @param {{
 *   urls: string[]
 *   indiceInicial: number
 *   aberto: boolean
 *   onFechar: () => void
 * }} props
 */
export default function ModalFotos({ urls, indiceInicial, aberto, onFechar }) {
  const [i, setI] = useState(indiceInicial)
  const [touchX, setTouchX] = useState(/** @type {number | null} */ (null))

  useEffect(() => {
    if (aberto) setI(Math.min(Math.max(0, indiceInicial), Math.max(0, urls.length - 1)))
  }, [aberto, indiceInicial, urls.length])

  const prev = useCallback(() => {
    setI((x) => (x > 0 ? x - 1 : urls.length - 1))
  }, [urls.length])

  const next = useCallback(() => {
    setI((x) => (x < urls.length - 1 ? x + 1 : 0))
  }, [urls.length])

  useEffect(() => {
    if (!aberto) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, prev, next, onFechar])

  const baixar = async () => {
    const url = urls[i]
    if (!url) return
    try {
      const r = await fetch(url)
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `foto-${i + 1}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(url, '_blank')
    }
  }

  if (!aberto || urls.length === 0) return null

  const url = urls[i]

  return (
    <div className="fixed inset-0 z-[240] flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm">
          {i + 1}/{urls.length}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={() => void baixar()} className="rounded-full bg-black/40 p-2 hover:bg-white/10" aria-label="Download">
            <Download size={22} />
          </button>
          <button type="button" onClick={onFechar} className="rounded-full bg-black/40 p-2 hover:bg-white/10" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 touch-pan-y"
        onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touchX == null) return
          const end = e.changedTouches[0]?.clientX ?? touchX
          const d = end - touchX
          if (d > 50) prev()
          if (d < -50) next()
          setTouchX(null)
        }}
      >
        <div className="relative h-full max-h-[70vh] w-full max-w-3xl">
          <Image src={url} alt="" fill className="object-contain" sizes="(max-width: 768px) 100vw, 720px" />
        </div>
        {urls.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white md:block"
              aria-label="Anterior"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white md:block"
              aria-label="Próxima"
            >
              <ChevronRight size={28} />
            </button>
          </>
        ) : null}
      </div>

      <div className="flex gap-1 overflow-x-auto border-t border-white/10 p-2">
        {urls.map((u, idx) => (
          <button
            key={`${u}-${idx}`}
            type="button"
            onClick={() => setI(idx)}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${idx === i ? 'border-[#0097b2]' : 'border-transparent opacity-70'}`}
          >
            <Image src={u} alt="" fill className="object-cover" sizes="56px" />
          </button>
        ))}
      </div>
    </div>
  )
}
