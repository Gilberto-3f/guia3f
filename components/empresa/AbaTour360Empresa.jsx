'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'

const PANNELLUM_CSS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css'
const PANNELLUM_JS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js'

/** @type {Promise<void> | null} */
let cssPromise = null
/** @type {Promise<void> | null} */
let jsPromise = null

function loadPannellumAssets() {
  if (typeof window === 'undefined') return Promise.resolve()

  if (!cssPromise) {
    cssPromise = new Promise((resolve) => {
      if (document.querySelector('link[data-pannellum-css="1"]')) {
        resolve()
        return
      }
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = PANNELLUM_CSS
      l.setAttribute('data-pannellum-css', '1')
      l.onload = () => resolve()
      l.onerror = () => resolve()
      document.head.appendChild(l)
    })
  }

  if (!jsPromise) {
    jsPromise = new Promise((resolve, reject) => {
      if (/** @type {Window & { pannellum?: unknown }} */ (window).pannellum) {
        resolve()
        return
      }
      const s = document.createElement('script')
      s.src = PANNELLUM_JS
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Pannellum'))
      document.body.appendChild(s)
    })
  }

  return Promise.all([cssPromise, jsPromise]).then(() => {})
}

/**
 * @param {{ fotos360Url: string[] }} props
 */
export default function AbaTour360Empresa({ fotos360Url }) {
  const urls = Array.isArray(fotos360Url) ? fotos360Url.filter((u) => typeof u === 'string' && u.trim()) : []
  const reactDomId = useId().replace(/:/g, '')
  const containerElId = `pannellum-empresa-${reactDomId}`
  const viewerRef = useRef(/** @type {{ destroy?: () => void } | null} */ (null))
  const [modalAberto, setModalAberto] = useState(false)
  const [urlAtiva, setUrlAtiva] = useState('')
  const [erroCarregamento, setErroCarregamento] = useState('')

  useEffect(() => {
    if (!modalAberto || !urlAtiva) return
    let cancelado = false
    const id = containerElId

    const run = async () => {
      setErroCarregamento('')
      try {
        await loadPannellumAssets()
        if (cancelado) return
        const Pannellum = /** @type {{ viewer: (target: string, config: Record<string, unknown>) => { destroy?: () => void } } | undefined} */ (
          /** @type {Window & { pannellum?: { viewer: (target: string, config: Record<string, unknown>) => { destroy?: () => void } } }} */ (window)
        ).pannellum
        if (!Pannellum) {
          setErroCarregamento('Visualizador 360° indisponível.')
          return
        }
        const el = document.getElementById(id)
        if (!el) return
        if (viewerRef.current && typeof viewerRef.current.destroy === 'function') {
          try {
            viewerRef.current.destroy()
          } catch {
            /* ignore */
          }
          viewerRef.current = null
        }
        el.innerHTML = ''
        viewerRef.current = Pannellum.viewer(id, {
          type: 'equirectangular',
          panorama: urlAtiva,
          autoLoad: true,
        })
      } catch {
        if (!cancelado) setErroCarregamento('Não foi possível carregar o visualizador 360°.')
      }
    }

    void run()

    return () => {
      cancelado = true
      if (viewerRef.current && typeof viewerRef.current.destroy === 'function') {
        try {
          viewerRef.current.destroy()
        } catch {
          /* ignore */
        }
      }
      viewerRef.current = null
      const el = document.getElementById(containerElId)
      if (el) el.innerHTML = ''
    }
  }, [modalAberto, urlAtiva, containerElId])

  if (urls.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-500">Nenhuma imagem 360° cadastrada</p>
  }

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">Toque em uma miniatura para abrir a vista 360° (arraste para girar, use o scroll para zoom).</p>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4">
        {urls.map((src, idx) => (
          <button
            key={`${src}-${idx}`}
            type="button"
            onClick={() => {
              setUrlAtiva(src)
              setModalAberto(true)
            }}
            className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0097b2] focus:ring-offset-2"
          >
            <Image src={src} alt="" fill className="object-cover" sizes="(max-width: 768px) 33vw, 25vw" />
          </button>
        ))}
      </div>

      {modalAberto ? (
        <div
          className="fixed inset-0 z-[140] flex flex-col bg-black/80 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização 360 graus"
        >
          <div className="mb-2 flex shrink-0 justify-end">
            <button
              type="button"
              onClick={() => {
                setModalAberto(false)
                setUrlAtiva('')
              }}
              className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Fechar"
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
            {erroCarregamento ? (
              <div className="flex h-[50vh] items-center justify-center px-4 text-center text-sm text-white">{erroCarregamento}</div>
            ) : (
              <div id={containerElId} className="h-[min(70vh,560px)] w-full" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
