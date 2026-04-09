'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from '@/i18n/navigation'
import { ArrowLeft, Repeat2, X } from 'lucide-react'
import Cropper, { type Area } from 'react-easy-crop'
import { supabase } from '@/lib/supabase'
import { getCroppedImageBlob } from '@/lib/cropImage'

type Aba = 'foto' | 'texto'

type FormatoFoto = 'portrait' | 'square' | 'landscape'

const FORMATOS: Record<
  FormatoFoto,
  { label: string; w: number; h: number; aspect: number; miniAspectClass: string }
> = {
  portrait: { label: 'Retrato', w: 1080, h: 1350, aspect: 4 / 5, miniAspectClass: 'aspect-[4/5] w-6' },
  square: { label: 'Quadrada', w: 1080, h: 1080, aspect: 1, miniAspectClass: 'aspect-square w-7' },
  landscape: {
    label: 'Paisagem',
    w: 1080,
    h: 566,
    aspect: 1080 / 566,
    miniAspectClass: 'aspect-video w-9 max-w-[2.5rem]',
  },
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
  /** Permissão de câmera (Permissions API); sem API → tratar como prompt (exige toque). */
  const [cameraPermissao, setCameraPermissao] = useState<'verificando' | 'concedida' | 'prompt' | 'negada'>(
    'verificando'
  )
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  /** Área do editor de texto colada ao teclado (visualViewport). */
  const [textoLayout, setTextoLayout] = useState<{ top: number; height: number } | null>(null)

  const abaRef = useRef<Aba>('foto')
  const headerRef = useRef<HTMLDivElement | null>(null)
  const inputGaleriaRef = useRef<HTMLInputElement | null>(null)
  const textareaTextoRef = useRef<HTMLTextAreaElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraGenRef = useRef(0)
  const facingAoLigarRef = useRef(facingMode)
  facingAoLigarRef.current = facingMode
  const facingMountedRef = useRef(facingMode)
  const [cameraAoVivo, setCameraAoVivo] = useState(false)

  const pararCamera = useCallback(() => {
    cameraGenRef.current += 1
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraAoVivo(false)
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

  const ligarCamera = useCallback(async () => {
    if (abaRef.current !== 'foto') return
    const gen = ++cameraGenRef.current
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraAoVivo(false)
    setCameraErro(false)
    const face = facingAoLigarRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: face } },
        audio: false,
      })
      if (gen !== cameraGenRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await v.play().catch(() => {})
      }
      if (gen === cameraGenRef.current) setCameraAoVivo(true)
    } catch {
      if (gen === cameraGenRef.current) setCameraErro(true)
    }
  }, [])

  /** Sincroniza estado da permissão (evita pedir câmera só ao entrar na página). */
  useEffect(() => {
    if (aba !== 'foto') {
      setCameraPermissao('verificando')
      return
    }
    let status: PermissionStatus | null = null
    const sync = () => {
      if (!status) return
      const s = status.state
      setCameraPermissao(s === 'granted' ? 'concedida' : s === 'denied' ? 'negada' : 'prompt')
    }
    ;(async () => {
      try {
        status = await navigator.permissions.query({ name: 'camera' as const })
        sync()
        status.addEventListener('change', sync)
      } catch {
        setCameraPermissao('prompt')
      }
    })()
    return () => {
      status?.removeEventListener('change', sync)
    }
  }, [aba])

  /** Com permissão já concedida pelo site, reabre a câmera ao voltar à aba (sem novo diálogo). */
  useEffect(() => {
    if (aba !== 'foto' || fotoPreview) {
      pararCamera()
      return
    }
    if (cameraPermissao === 'verificando' || cameraPermissao === 'negada') return
    if (cameraPermissao !== 'concedida') return
    /* Evita parar e religar quando o utilizador acabou de ativar via botão (prompt → concedida). */
    if (streamRef.current?.active) return

    void ligarCamera()
    return () => {
      pararCamera()
    }
  }, [aba, fotoPreview, cameraPermissao, ligarCamera, pararCamera])

  /** Troca frontal/traseira: só após já existir stream (permissão já obtida nesta sessão). */
  useEffect(() => {
    if (aba !== 'foto' || fotoPreview || cameraPermissao === 'negada') {
      facingMountedRef.current = facingMode
      return
    }
    const prev = facingMountedRef.current
    facingMountedRef.current = facingMode
    if (prev === facingMode) return
    if (!streamRef.current?.active) return
    void ligarCamera()
  }, [facingMode, aba, fotoPreview, cameraPermissao, ligarCamera])

  const onAtivarCamera = () => {
    void ligarCamera()
  }

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
    abaRef.current = aba
  }, [aba])

  /** Cola o campo de texto ao teclado (sem margem): do fim das abas até o topo do teclado. */
  const atualizarLayoutTexto = useCallback(() => {
    if (abaRef.current !== 'texto') return
    const header = headerRef.current
    const vv = window.visualViewport
    if (!header || !vv) return

    const headerBottom = header.getBoundingClientRect().bottom
    const areaVisivelInferior = vv.offsetTop + vv.height
    const height = Math.max(64, Math.floor(areaVisivelInferior - headerBottom))
    const top = Math.floor(headerBottom)

    setTextoLayout((prev) => {
      if (prev?.top === top && prev?.height === height) return prev
      return { top, height }
    })
  }, [])

  useEffect(() => {
    if (aba !== 'texto') {
      setTextoLayout(null)
      return
    }

    atualizarLayoutTexto()
    const run = () => requestAnimationFrame(atualizarLayoutTexto)

    const vv = window.visualViewport
    vv?.addEventListener('resize', run)
    vv?.addEventListener('scroll', run)
    window.addEventListener('resize', run)
    let ro: ResizeObserver | null = null
    const attachHeaderObserver = () => {
      const el = headerRef.current
      if (!el || ro) return
      ro = new ResizeObserver(run)
      ro.observe(el)
    }
    attachHeaderObserver()
    const rafAttach = requestAnimationFrame(attachHeaderObserver)

    const focusTexto = () => {
      textareaTextoRef.current?.focus({ preventScroll: true })
    }
    requestAnimationFrame(focusTexto)
    const t = window.setTimeout(focusTexto, 120)

    return () => {
      cancelAnimationFrame(rafAttach)
      vv?.removeEventListener('resize', run)
      vv?.removeEventListener('scroll', run)
      window.removeEventListener('resize', run)
      ro?.disconnect()
      window.clearTimeout(t)
    }
  }, [aba, atualizarLayoutTexto])

  /** Mantém o teclado na aba TEXTO: recoloca foco se não foi para o cabeçalho (Voltar/Publicar/abas). */
  const onTextoBlur = useCallback(() => {
    if (abaRef.current !== 'texto') return
    window.setTimeout(() => {
      if (abaRef.current !== 'texto') return
      const active = document.activeElement
      if (active && headerRef.current?.contains(active)) return
      textareaTextoRef.current?.focus({ preventScroll: true })
    }, 30)
  }, [])

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
        texto: !texto.trim() ? null : texto,
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
    <div
      className={`flex min-h-screen flex-col bg-gray-50 ${aba === 'texto' ? 'pb-0' : 'pb-[calc(3.75rem+env(safe-area-inset-bottom))]'}`}
    >
      <div
        ref={headerRef}
        className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm"
        data-criar-header
      >
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
        <div className="flex flex-col px-0.5 pb-0 pt-1 sm:px-1">
          <input
            ref={inputGaleriaRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Abrir galeria"
            onChange={onFotoGaleria}
          />

          {!fotoPreview ? (
            <div className="flex flex-1 flex-col gap-3 px-0.5 pb-1 pt-1">
              <div className="relative w-full overflow-hidden rounded-xl bg-neutral-800">
                {cameraPermissao === 'negada' ? (
                  <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 bg-neutral-900 p-4 text-center text-sm font-bold text-[#0097b2]">
                    <p>Câmera bloqueada para este site.</p>
                    <p className="text-xs font-semibold text-white/80">
                      Permita o acesso à câmera nas configurações do navegador (normalmente fica &quot;Permitir&quot; e memoriza para o domínio).
                    </p>
                  </div>
                ) : cameraErro ? (
                  <div className="flex aspect-[4/5] w-full items-center justify-center bg-neutral-900 p-4 text-center text-sm font-bold text-[#0097b2]">
                    Não foi possível acessar a câmera. Use a galeria abaixo ou toque em tentar novamente.
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="aspect-[4/5] w-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />
                    {cameraPermissao === 'verificando' ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                        <span className="text-xs font-bold text-white/90">Verificando permissão…</span>
                      </div>
                    ) : null}
                    {cameraPermissao === 'prompt' && !cameraAoVivo ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65 px-6">
                        <p className="text-center text-xs font-semibold text-white/90">
                          Toque uma vez para pedir o acesso à câmera. Se já permitiu para este site, o vídeo abre sem novo aviso.
                        </p>
                        <button
                          type="button"
                          onClick={onAtivarCamera}
                          className="rounded-xl bg-[#0097b2] px-5 py-2.5 text-sm font-bold text-white shadow-md"
                        >
                          Ativar câmera
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="flex items-center justify-center gap-3">
                {cameraAoVivo && !cameraErro && cameraPermissao !== 'negada' ? (
                  <button
                    type="button"
                    onClick={() => setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white bg-black/50 text-white shadow-md backdrop-blur-[2px]"
                    aria-label={facingMode === 'environment' ? 'Usar câmera frontal' : 'Usar câmera traseira'}
                  >
                    <Repeat2 size={20} strokeWidth={2.25} aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={capturarDaCamera}
                  disabled={cameraErro || !cameraAoVivo || cameraPermissao === 'negada'}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#0097b2] bg-white shadow-lg disabled:opacity-40"
                  aria-label="Fotografar"
                >
                  <span className="h-11 w-11 rounded-full bg-[#0097b2]" />
                </button>
              </div>

              {cameraErro ? (
                <button
                  type="button"
                  onClick={onAtivarCamera}
                  className="w-full rounded-xl border-2 border-[#0097b2] bg-white py-3 text-center text-sm font-bold text-[#0097b2]"
                >
                  Tentar câmera novamente
                </button>
              ) : null}

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
              <div className="mb-2 flex w-full flex-nowrap gap-1.5 sm:gap-2">
                {(Object.keys(FORMATOS) as FormatoFoto[]).map((key) => {
                  const f = FORMATOS[key]
                  const ativo = formatoFoto === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormatoFoto(key)}
                      className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-xs transition sm:px-2 ${
                        ativo
                          ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
                          : 'border-gray-200 bg-white font-bold text-[#0097b2]/80'
                      }`}
                    >
                      <span className="text-[11px] font-bold leading-tight sm:text-xs">{f.label}</span>
                      <div
                        className={`shrink-0 rounded-sm border-2 border-current bg-[#0097b2]/20 ${f.miniAspectClass}`}
                        aria-hidden
                      />
                    </button>
                  )
                })}
              </div>

              <p className="mb-1.5 text-center text-[11px] font-bold text-[#0097b2]/80">
                Pinça para zoom · arraste para posicionar
              </p>

              <div className="relative w-full">
                <button
                  type="button"
                  onClick={limparFoto}
                  className="absolute right-1 top-1 z-10 rounded-full bg-black/50 p-1.5 text-white shadow-md"
                  aria-label="Remover foto e escolher outra"
                >
                  <X size={18} aria-hidden />
                </button>
                <div className="relative h-[min(54vh,420px)] w-full overflow-hidden rounded-lg bg-white">
                  <Cropper
                    image={fotoPreview}
                    crop={crop}
                    zoom={zoom}
                    aspect={FORMATOS[formatoFoto].aspect}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    showGrid={false}
                    objectFit="cover"
                  />
                </div>
              </div>

              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Legenda (opcional)..."
                className="mt-3 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-base font-bold whitespace-pre-wrap text-[#0097b2] placeholder:font-bold placeholder:text-[#0097b2]/45 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                rows={4}
              />

              <button
                type="button"
                onClick={() => void handleSubmit('foto')}
                disabled={!fotoPreview || !croppedAreaPixels || loading}
                className="mt-3 w-full rounded-xl bg-[#0097b2] py-3.5 text-center text-base font-bold text-white shadow-sm transition disabled:opacity-50"
              >
                {loading ? 'Publicando...' : 'Publicar'}
              </button>
            </>
          )}
        </div>
      ) : textoLayout ? (
        <textarea
          ref={textareaTextoRef}
          value={texto}
          onChange={onTextoChange}
          onBlur={onTextoBlur}
          placeholder="O que você está pensando?"
          className="box-border resize-none border-0 border-t border-gray-200 bg-white px-3 py-2 text-base font-bold leading-relaxed text-[#0097b2] placeholder:font-bold placeholder:text-[#0097b2]/45 focus:outline-none focus:ring-0"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            width: '100%',
            top: textoLayout.top,
            height: textoLayout.height,
            overflowY: 'auto',
            zIndex: 20,
            WebkitOverflowScrolling: 'touch',
          }}
          enterKeyHint="enter"
        />
      ) : (
        <div className="min-h-[40vh] bg-white" aria-hidden />
      )}
    </div>
  )
}
