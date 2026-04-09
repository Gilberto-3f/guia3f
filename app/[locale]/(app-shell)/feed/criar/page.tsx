'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from '@/i18n/navigation'
import { ArrowLeft, Camera, Images, X } from 'lucide-react'
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
  return `flex-1 py-3 text-center text-sm font-semibold tracking-wide transition-colors ${
    ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-gray-500'
  }`
}

export default function CriarPublicacaoPage() {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('foto')
  const [texto, setTexto] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formatoFoto, setFormatoFoto] = useState<FormatoFoto>('portrait')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const inputCameraRef = useRef<HTMLInputElement | null>(null)
  const inputGaleriaRef = useRef<HTMLInputElement | null>(null)
  const textareaTextoRef = useRef<HTMLTextAreaElement | null>(null)

  const limparFoto = useCallback(() => {
    setFoto(null)
    setFotoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }, [])

  const onFotoEscolhida = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setFoto(file)
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
        const fileExt = 'jpg'
        const fileName = `${Date.now()}.${fileExt}`
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between p-4">
          <button type="button" onClick={() => router.back()} className="-ml-1 p-1" aria-label="Voltar">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold">Nova publicação</h1>
          {aba === 'texto' ? (
            <button
              type="button"
              onClick={() => void handleSubmit('texto')}
              disabled={!texto.trim() || loading}
              className="rounded-lg bg-[#0097b2] px-4 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Publicando...' : 'Publicar'}
            </button>
          ) : (
            <span className="w-[72px]" aria-hidden />
          )}
        </div>

        <div className="border-b border-gray-200 bg-white">
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
        <div className="p-4">
          <input
            ref={inputCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFotoEscolhida}
          />
          <input
            ref={inputGaleriaRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFotoEscolhida}
          />

          {!fotoPreview ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => inputCameraRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white py-8 text-[#0097b2] shadow-sm transition hover:border-[#0097b2]/40"
              >
                <Camera className="h-10 w-10" strokeWidth={1.75} aria-hidden />
                <span className="text-sm font-semibold">CÂMERA</span>
              </button>
              <button
                type="button"
                onClick={() => inputGaleriaRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white py-8 text-[#0097b2] shadow-sm transition hover:border-[#0097b2]/40"
              >
                <Images className="h-10 w-10" strokeWidth={1.75} aria-hidden />
                <span className="text-sm font-semibold">GALERIA</span>
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
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <span className="block font-semibold">{f.label}</span>
                      <span className="text-[10px] text-gray-500">{f.sub}</span>
                    </button>
                  )
                })}
              </div>

              <p className="mb-2 text-center text-xs text-gray-500">
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
                <span className="text-xs text-gray-500">Zoom</span>
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
                className="mt-4 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                rows={4}
              />

              <button
                type="button"
                onClick={() => void handleSubmit('foto')}
                disabled={!fotoPreview || !croppedAreaPixels || loading}
                className="mt-4 w-full rounded-xl bg-[#0097b2] py-3.5 text-center text-base font-semibold text-white shadow-sm transition disabled:opacity-50"
              >
                {loading ? 'Publicando...' : 'Publicar'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex min-h-[50vh] flex-col p-4">
          <textarea
            ref={textareaTextoRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="O que você está pensando?"
            className="min-h-[40vh] w-full flex-1 resize-none rounded-lg border border-gray-200 bg-white p-4 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
            rows={12}
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
