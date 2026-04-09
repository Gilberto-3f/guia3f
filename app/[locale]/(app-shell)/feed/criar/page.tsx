'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from '@/i18n/navigation'
import { ArrowLeft, X } from 'lucide-react'
import Cropper, { type Area } from 'react-easy-crop'
import { supabase } from '@/lib/supabase'
import { getCroppedImageBlob } from '@/lib/cropImage'

type Aba = 'foto' | 'texto'

type FormatoFoto = 'portrait' | 'square' | 'landscape'

const FORMATOS: Record<
  FormatoFoto,
  { label: string; sub: string; w: number; h: number; aspect: number }
> = {
  portrait: { label: 'Retrato', sub: '1080×1350 · 4:5', w: 1080, h: 1350, aspect: 4 / 5 },
  square: { label: 'Quadrada', sub: '1080×1080 · 1:1', w: 1080, h: 1080, aspect: 1 },
  landscape: { label: 'Paisagem', sub: '1080×566 · 16:9', w: 1080, h: 566, aspect: 1080 / 566 },
}

function tabCls(ativo: boolean) {
  return `flex-1 py-2 text-center text-sm font-bold tracking-wide transition-colors ${
    ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-[#0097b2]/55'
  }`
}

export default function CriarPublicacaoPage() {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('foto')
  const [texto, setTexto] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formatoFoto, setFormatoFoto] = useState<FormatoFoto>('portrait')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [cameraErro, setCameraErro] = useState(false)
  const [alturaTextoPx, setAlturaTextoPx] = useState<number | null>(null)

  const inputGaleriaRef = useRef<HTMLInputElement | null>(null)
  const textareaTextoRef = useRef<HTMLTextAreaElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const pararCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const limparFoto = useCallback(() => {
    setFotoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }, [])

  /** Câmera ao abrir a aba FOTO (sem popup): preview em vídeo + fotografar. */
  useEffect(() => {
    if (aba !== 'foto' || fotoPreview) {
      pararCamera()
      return
    }

    setCameraErro(false)
    let cancel = false

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancel) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          await v.play().catch(() => {})
        }
      } catch {
        if (!cancel) setCameraErro(true)
      }
    })()

    return () => {
      cancel = true
      pararCamera()
    }
  }, [aba, fotoPreview, pararCamera])

  const capturarDaCamera = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setFotoPreview((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setCroppedAreaPixels(null)
      },
      'image/jpeg',
      0.92
    )
  }, [])

  const onFotoGaleria = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setFotoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  useEffect(() => {
    if (aba === 'texto') {
      const t = window.setTimeout(() => textareaTextoRef.current?.focus(), 150)
      return () => clearTimeout(t)
    }
  }, [aba])

  /** Altura útil acima do teclado (mobile). */
  useEffect(() => {
    if (aba !== 'texto') return

    const HEADER_BOTTOM = 104
    const BOTTOM_BAR = 76

    const atualizar = () => {
      const vv = window.visualViewport
      const vh = vv?.height ?? window.innerHeight
      const h = vh - HEADER_BOTTOM - BOTTOM_BAR
      setAlturaTextoPx(Math.max(140, Math.floor(h)))
    }

    atualizar()
    const vv = window.visualViewport
    vv?.addEventListener('resize', atualizar)
    vv?.addEventListener('scroll', atualizar)
    window.addEventListener('resize', atualizar)
    return () => {
      vv?.removeEventListener('resize', atualizar)
      vv?.removeEventListener('scroll', atualizar)
      window.removeEventListener('resize', atualizar)
    }
  }, [aba])

  /** Mantém o fim do texto visível (comportamento “sobe” sem aumentar o campo). */
  const onTextoChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setTexto(e.target.value)
    const el = e.target
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }

  const handleSubmit = async (origem: 'foto' | 'texto') => {
    const meta = FORMATOS[formatoFoto]
    if (origem === 'foto') {
      if (!fotoPreview || !croppedAreaPixels) return
    } else {
      if (!texto.trim()) return
    }

    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        alert('Faça login para continuar')
        return
      }

      let fotoUrl: string | null = null
      let fileToUpload: File | null = null

      if (origem === 'foto' && fotoPreview && croppedAreaPixels) {
        const blob = await getCroppedImageBlob(
          fotoPreview,
          croppedAreaPixels,
          meta.w,
          meta.h,
          'image/jpeg',
          0.92
        )
        fileToUpload = new File([blob], `post-${Date.now()}.jpg`, { type: 'image/jpeg' })
      }

      if (fileToUpload) {
        const fileName = `${Date.now()}.jpg`
        const filePath = `${session.user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('posts').upload(filePath, fileToUpload, {
          upsert: false,
        })

        if (uploadError) throw uploadError

        const { data: pub } = supabase.storage.from('posts').getPublicUrl(filePath)
        fotoUrl = pub.publicUrl
      }

      const tipo =
        origem === 'texto' ? 'texto' : fotoUrl && texto.trim() ? 'misto' : fotoUrl ? 'foto' : 'texto'

      const { error } = await supabase.from('posts').insert({
        autor_id: session.user.id,
        texto: texto.trim() || null,
        foto_url: fotoUrl,
        conteudo_url: fotoUrl,
        tipo,
      })

      if (error) throw error

      router.push('/feed')
      router.refresh()
    } catch (err) {
      console.error('Erro ao criar publicação:', err)
      alert('Não foi possível publicar. Verifique o bucket posts e as políticas no Supabase.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-3 py-1.5">
          <button type="button" onClick={() => router.back()} className="-ml-1 p-1" aria-label="Voltar">
            <ArrowLeft size={22} className="text-[#0097b2]" strokeWidth={2.25} />
          </button>
          <h1 className="text-center text-base font-bold text-[#0097b2]">NOVA PUBLICAÇÃO</h1>
          {aba === 'texto' ? (
            <button
              type="button"
              onClick={() => void handleSubmit('texto')}
              disabled={!texto.trim() || loading}
              className="rounded-lg bg-[#0097b2] px-3 py-1 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Publicando...' : 'Publicar'}
            </button>
          ) : (
            <span className="w-[68px]" aria-hidden />
          )}
        </div>

        <div className="border-t border-gray-100 bg-white">
          <div className="flex">
            <button type="button" className={tabCls(aba === 'foto')} onClick={() => setAba('foto')}>
              FOTO
            </button>
            <button type="button" className={tabCls(aba === 'texto')} onClick={() => setAba('texto')}>
              TEXTO
            </button>
          </div>
        </div>
      </div>

      {aba === 'foto' ? (
        <div className="flex flex-1 flex-col p-4">
          <input
            ref={inputGaleriaRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Abrir galeria"
            onChange={onFotoGaleria}
          />

          {!fotoPreview ? (
            <div className="flex flex-1 flex-col gap-4">
              <div className="relative w-full overflow-hidden rounded-xl bg-black">
                {cameraErro ? (
                  <div className="flex aspect-[4/5] w-full items-center justify-center bg-neutral-900 p-4 text-center text-sm font-bold text-[#0097b2]">
                    Não foi possível acessar a câmera. Use a galeria abaixo.
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    className="aspect-[4/5] w-full object-cover"
                    playsInline
                    muted
                    autoPlay
                  />
                )}
              </div>

              <button
                type="button"
                onClick={capturarDaCamera}
                disabled={cameraErro}
                className="mx-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#0097b2] bg-white shadow-lg disabled:opacity-40"
                aria-label="Fotografar"
              >
                <span className="h-11 w-11 rounded-full bg-[#0097b2]" />
              </button>

              <button
                type="button"
                onClick={() => inputGaleriaRef.current?.click()}
                className="w-full rounded-xl bg-[#0097b2] py-3.5 text-center text-base font-bold text-white shadow-sm"
              >
                GALERIA
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {(Object.keys(FORMATOS) as FormatoFoto[]).map((key) => {
                  const f = FORMATOS[key]
                  const ativo = formatoFoto === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormatoFoto(key)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                        ativo
                          ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
                          : 'border-gray-200 bg-white font-bold text-[#0097b2]/80'
                      }`}
                    >
                      <span className="block font-bold">{f.label}</span>
                      <span className="text-[10px] font-semibold text-[#0097b2]/70">{f.sub}</span>
                    </button>
                  )
                })}
              </div>

              <p className="mb-2 text-center text-xs font-bold text-[#0097b2]/80">
                Pinça para zoom · arraste para posicionar
              </p>

              <div className="relative mx-auto w-full max-w-lg">
                <button
                  type="button"
                  onClick={limparFoto}
                  className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white shadow-md"
                  aria-label="Remover foto e escolher outra"
                >
                  <X size={18} aria-hidden />
                </button>
                <div className="relative h-[min(52vh,440px)] w-full overflow-hidden rounded-xl bg-neutral-900">
                  <Cropper
                    image={fotoPreview}
                    crop={crop}
                    zoom={zoom}
                    aspect={FORMATOS[formatoFoto].aspect}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    showGrid={false}
                  />
                </div>
              </div>

              <div className="mx-auto mt-3 flex max-w-lg items-center gap-3 px-1">
                <span className="text-xs font-bold text-[#0097b2]/80">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-[#0097b2]"
                  aria-label="Zoom da foto"
                />
              </div>

              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Legenda (opcional)..."
                className="mt-4 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-base font-bold text-[#0097b2] placeholder:font-bold placeholder:text-[#0097b2]/45 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                rows={4}
              />

              <button
                type="button"
                onClick={() => void handleSubmit('foto')}
                disabled={!fotoPreview || !croppedAreaPixels || loading}
                className="mt-4 w-full rounded-xl bg-[#0097b2] py-3.5 text-center text-base font-bold text-white shadow-sm transition disabled:opacity-50"
              >
                {loading ? 'Publicando...' : 'Publicar'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-3 pt-1">
          <textarea
            ref={textareaTextoRef}
            value={texto}
            onChange={onTextoChange}
            placeholder="O que você está pensando?"
            className="w-full shrink-0 resize-none rounded-lg border border-gray-200 bg-white p-3 text-base font-bold leading-relaxed text-[#0097b2] placeholder:font-bold placeholder:text-[#0097b2]/45 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
            style={{
              height: alturaTextoPx ?? 'calc(100dvh - 6.75rem - env(safe-area-inset-bottom))',
              maxHeight: alturaTextoPx ?? 'calc(100dvh - 6.75rem - env(safe-area-inset-bottom))',
              overflowY: 'auto',
            }}
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
