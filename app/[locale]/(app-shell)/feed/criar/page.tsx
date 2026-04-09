'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { usePathname, useSearchParams, useRouter as useNextRouter } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { Image as ImageIcon, Repeat2, X } from 'lucide-react'
import Cropper, { type Area, type MediaSize, type Size } from 'react-easy-crop'
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

const BOTTOM_BAR_OFFSET = 'calc(5rem + env(safe-area-inset-bottom, 0px))'

/**
 * Lista explícita de imagens (evita `image/*`, que em vários browsers dispara o menu
 * “Câmera / Fototeca / Ficheiros”). Não incluir `capture` — isso forçaria a câmera.
 */
const ACCEPT_GALERIA_IMAGENS =
  'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif'

/** Cobre o recorte sem vãos: paisagem = preencher altura; retrato = preencher largura; quadrado = auto. */
function objectFitParaFormato(f: FormatoFoto): 'cover' | 'horizontal-cover' | 'vertical-cover' {
  const a = FORMATOS[f].aspect
  if (Math.abs(a - 1) < 0.02) return 'cover'
  return a > 1 ? 'vertical-cover' : 'horizontal-cover'
}

function tabCls(ativo: boolean) {
  return `flex-1 py-3 text-center text-sm font-bold tracking-wide transition-colors ${
    ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-[#0097b2]/55'
  }`
}

function daUrlParaAba(sp: ReturnType<typeof useSearchParams>): Aba {
  return sp.get('aba') === 'texto' ? 'texto' : 'foto'
}

function CriarPublicacaoPageInner() {
  const router = useRouter()
  const nextRouter = useNextRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [aba, setAba] = useState<Aba>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('aba') === 'texto'
      ? 'texto'
      : 'foto'
  )

  const sincronizarUrlComAba = useCallback(
    (next: Aba) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'texto') params.set('aba', 'texto')
      else params.delete('aba')
      const qs = params.toString()
      nextRouter.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, searchParams, nextRouter]
  )

  useEffect(() => {
    setAba(daUrlParaAba(searchParams))
  }, [searchParams])

  const irParaFoto = useCallback(() => {
    flushSync(() => setAba('foto'))
    sincronizarUrlComAba('foto')
  }, [sincronizarUrlComAba])

  const irParaTexto = useCallback(() => {
    flushSync(() => setAba('texto'))
    sincronizarUrlComAba('texto')
    const el = textareaTextoRef.current
    if (el) {
      el.readOnly = false
      el.focus({ preventScroll: true })
      try {
        const len = el.value.length
        el.setSelectionRange(len, len)
      } catch {
        /* noop */
      }
    }
  }, [sincronizarUrlComAba])

  const [texto, setTexto] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formatoFoto, setFormatoFoto] = useState<FormatoFoto>('portrait')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [cropMinZoom, setCropMinZoom] = useState(1)
  const cropMinZoomRef = useRef(1)
  const lastMediaForCropRef = useRef<MediaSize | null>(null)
  const lastCropSizeRef = useRef<Size | null>(null)
  const [cameraErro, setCameraErro] = useState(false)
  const [cameraPermissao, setCameraPermissao] = useState<'verificando' | 'concedida' | 'prompt' | 'negada'>(
    'verificando'
  )
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [textoLayout, setTextoLayout] = useState<{ top: number; height: number } | null>(null)

  const abaRef = useRef<Aba>(aba)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const textoToolbarRef = useRef<HTMLDivElement | null>(null)
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

  useEffect(() => {
    if (aba !== 'foto' || fotoPreview) {
      pararCamera()
      return
    }
    if (cameraPermissao === 'verificando' || cameraPermissao === 'negada') return
    if (cameraPermissao !== 'concedida') return
    if (streamRef.current?.active) return

    void ligarCamera()
    return () => {
      pararCamera()
    }
  }, [aba, fotoPreview, cameraPermissao, ligarCamera, pararCamera])

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

  const abrirGaleria = useCallback(() => {
    const input = inputGaleriaRef.current
    if (!input) return
    try {
      const el = input as HTMLInputElement & { showPicker?: () => void | Promise<void> }
      if (typeof el.showPicker === 'function') {
        const maybe = el.showPicker()
        if (maybe != null && typeof (maybe as Promise<void>).then === 'function') {
          void (maybe as Promise<void>).catch(() => input.click())
        }
        return
      }
    } catch {
      /* Transient activation / browser sem suporte */
    }
    input.click()
  }, [])

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  useEffect(() => {
    cropMinZoomRef.current = cropMinZoom
  }, [cropMinZoom])

  const recalcCropMinZoom = useCallback(() => {
    const ms = lastMediaForCropRef.current
    const cs = lastCropSizeRef.current
    if (!ms || !cs || ms.width <= 0 || ms.height <= 0) return
    const z = Math.max(cs.width / ms.width, cs.height / ms.height, 1)
    setCropMinZoom((prev) => (Math.abs(prev - z) < 1e-4 ? prev : z))
    setZoom((prev) => (prev < z ? z : prev))
  }, [])

  const onCropperMediaLoaded = useCallback(
    (ms: MediaSize) => {
      lastMediaForCropRef.current = ms
      recalcCropMinZoom()
    },
    [recalcCropMinZoom]
  )

  const onCropSizeChange = useCallback(
    (size: Size) => {
      lastCropSizeRef.current = size
      recalcCropMinZoom()
    },
    [recalcCropMinZoom]
  )

  const onZoomChangeCropper = useCallback((z: number) => {
    const minZ = cropMinZoomRef.current
    setZoom(Math.max(z, minZ))
  }, [])

  useEffect(() => {
    if (!fotoPreview) {
      lastMediaForCropRef.current = null
      lastCropSizeRef.current = null
      setCropMinZoom(1)
      cropMinZoomRef.current = 1
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      return
    }
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCropMinZoom(1)
    cropMinZoomRef.current = 1
    lastCropSizeRef.current = null
  }, [fotoPreview, formatoFoto])

  useEffect(() => {
    abaRef.current = aba
  }, [aba])

  const atualizarLayoutTexto = useCallback(() => {
    if (abaRef.current !== 'texto') return
    const header = headerRef.current
    if (!header) return
    const vv = window.visualViewport
    const headerBottom = header.getBoundingClientRect().bottom
    const areaVisivelInferior = vv ? vv.offsetTop + vv.height : window.innerHeight
    const height = Math.max(96, Math.floor(areaVisivelInferior - headerBottom))
    const top = Math.floor(headerBottom)

    setTextoLayout((prev) => {
      if (prev?.top === top && prev?.height === height) return prev
      return { top, height }
    })
  }, [])

  const focarTextarea = useCallback(() => {
    const el = textareaTextoRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    try {
      el.setSelectionRange(el.value.length, el.value.length)
    } catch {
      /* noop */
    }
  }, [])

  /** Medição + bloqueio de scroll da página (só o textarea rola). */
  useLayoutEffect(() => {
    if (aba !== 'texto') {
      setTextoLayout(null)
      return
    }

    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const header = headerRef.current
    if (header) {
      const vv = window.visualViewport
      const headerBottom = header.getBoundingClientRect().bottom
      const areaVisivelInferior = vv ? vv.offsetTop + vv.height : window.innerHeight
      const height = Math.max(96, Math.floor(areaVisivelInferior - headerBottom))
      const top = Math.floor(headerBottom)
      flushSync(() => setTextoLayout({ top, height }))
    }

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => focarTextarea())
    })

    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [aba, focarTextarea])

  useEffect(() => {
    if (aba !== 'texto') return

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

    const focusTexto = () => focarTextarea()
    requestAnimationFrame(focusTexto)
    const t = window.setTimeout(focusTexto, 50)

    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      focarTextarea()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      cancelAnimationFrame(rafAttach)
      vv?.removeEventListener('resize', run)
      vv?.removeEventListener('scroll', run)
      window.removeEventListener('resize', run)
      ro?.disconnect()
      window.clearTimeout(t)
      window.clearTimeout(t2)
    }
  }, [aba, atualizarLayoutTexto, focarTextarea])

  const onTextoBlur = useCallback(
    (e: FocusEvent<HTMLTextAreaElement>) => {
      if (abaRef.current !== 'texto') return
      const alvo = e.relatedTarget
      if (alvo instanceof Node) {
        if (headerRef.current?.contains(alvo)) return
        if (textoToolbarRef.current?.contains(alvo)) return
      }
      const refocar = () => {
        if (abaRef.current !== 'texto') return
        const active = document.activeElement
        if (active && headerRef.current?.contains(active)) return
        if (active && textoToolbarRef.current?.contains(active)) return
        focarTextarea()
      }
      window.setTimeout(refocar, 0)
      requestAnimationFrame(() => requestAnimationFrame(refocar))
    },
    [focarTextarea]
  )

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

  const formatosRow = (
    <div className="mb-1.5 flex w-full flex-nowrap gap-1.5 sm:gap-2">
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
  )

  return (
    <div
      className={`flex min-h-[100dvh] flex-col bg-gray-50 ${aba === 'texto' ? 'pb-0' : ''}`}
      style={
        aba === 'foto'
          ? { paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }
          : undefined
      }
    >
      <div
        ref={headerRef}
        className="sticky top-0 z-30 flex items-stretch border-b border-gray-200 bg-white shadow-sm"
        data-criar-header
      >
        <div className="flex min-w-0 flex-1">
          <button type="button" className={tabCls(aba === 'foto')} onClick={irParaFoto}>
            FOTO
          </button>
          <button type="button" className={tabCls(aba === 'texto')} onClick={irParaTexto}>
            TEXTO
          </button>
        </div>
      </div>

      {aba === 'foto' ? (
        <div className="flex flex-1 flex-col px-0.5 pt-1 sm:px-1">
          <input
            ref={inputGaleriaRef}
            type="file"
            accept={ACCEPT_GALERIA_IMAGENS}
            className="sr-only"
            aria-label="Abrir galeria"
            onChange={onFotoGaleria}
          />

          {!fotoPreview ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 px-0.5 pb-2 pt-0">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-neutral-800">
                {cameraPermissao === 'negada' ? (
                  <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-2 bg-neutral-900 p-4 text-center text-sm font-bold text-[#0097b2]">
                    <p>Câmera bloqueada para este site.</p>
                    <p className="text-xs font-semibold text-white/80">
                      Permita o acesso à câmera nas configurações do navegador (normalmente fica
                      &quot;Permitir&quot; e memoriza para o domínio).
                    </p>
                  </div>
                ) : cameraErro ? (
                  <div className="flex min-h-[50vh] w-full items-center justify-center bg-neutral-900 p-4 text-center text-sm font-bold text-[#0097b2]">
                    Não foi possível acessar a câmera. Use o ícone da galeria ou tente novamente.
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="h-full min-h-[44vh] w-full object-cover"
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
                          Toque uma vez para pedir o acesso à câmera. Se já permitiu para este site, o
                          vídeo abre sem novo aviso.
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

              {cameraErro ? (
                <button
                  type="button"
                  onClick={onAtivarCamera}
                  className="w-full rounded-xl border-2 border-[#0097b2] bg-white py-2.5 text-center text-sm font-bold text-[#0097b2]"
                >
                  Tentar câmera novamente
                </button>
              ) : null}

              <div
                className="fixed left-0 right-0 z-40 grid grid-cols-3 items-center gap-2 px-4"
                style={{ bottom: BOTTOM_BAR_OFFSET }}
              >
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={abrirGaleria}
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#0097b2] bg-white/95 text-[#0097b2] shadow-md backdrop-blur-sm"
                    aria-label="Abrir galeria"
                  >
                    <ImageIcon size={22} strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
                <div className="flex justify-center">
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
                <div className="flex justify-end">
                  {cameraAoVivo && !cameraErro && cameraPermissao !== 'negada' ? (
                    <button
                      type="button"
                      onClick={() => setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))}
                      className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-black/50 text-white shadow-md backdrop-blur-[2px]"
                      aria-label={facingMode === 'environment' ? 'Usar câmera frontal' : 'Usar câmera traseira'}
                    >
                      <Repeat2 size={20} strokeWidth={2.25} aria-hidden />
                    </button>
                  ) : (
                    <span className="h-11 w-11" aria-hidden />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {formatosRow}

              <p className="mb-1 text-center text-[11px] font-bold text-[#0097b2]/80">
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
                <div className="relative h-[min(54vh,420px)] w-full overflow-hidden rounded-lg bg-neutral-900">
                  <Cropper
                    key={`${fotoPreview}-${formatoFoto}`}
                    image={fotoPreview}
                    crop={crop}
                    zoom={zoom}
                    minZoom={cropMinZoom}
                    maxZoom={4}
                    aspect={FORMATOS[formatoFoto].aspect}
                    objectFit={objectFitParaFormato(formatoFoto)}
                    restrictPosition
                    onCropChange={setCrop}
                    onZoomChange={onZoomChangeCropper}
                    onCropComplete={onCropComplete}
                    onCropSizeChange={onCropSizeChange}
                    onMediaLoaded={onCropperMediaLoaded}
                    showGrid={false}
                  />
                </div>
              </div>

              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Legenda (opcional)..."
                className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-base font-bold whitespace-pre-wrap text-[#0097b2] placeholder:font-bold placeholder:text-[#0097b2]/45 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                rows={4}
              />

              <button
                type="button"
                onClick={() => void handleSubmit('foto')}
                disabled={!fotoPreview || !croppedAreaPixels || loading}
                className="mt-2 mb-0 w-full rounded-xl bg-[#0097b2] py-3 text-center text-base font-bold text-white shadow-sm transition disabled:opacity-50"
                style={{ marginBottom: 'max(0.25rem, env(safe-area-inset-bottom, 4px))' }}
              >
                {loading ? 'Postando...' : 'Postar'}
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* Sempre montado: o focus() no toque da aba TEXTO precisa do elemento no DOM (iOS/Android). */}
      <div
        className={
          aba === 'texto' && textoLayout
            ? 'fixed left-0 right-0 z-20 flex min-h-0 flex-col border-t border-gray-100 bg-white'
            : 'pointer-events-none fixed left-0 top-0 z-[-1] m-0 h-px max-h-[1px] w-px max-w-[1px] overflow-hidden border-0 p-0 opacity-0'
        }
        style={
          aba === 'texto' && textoLayout
            ? { top: textoLayout.top, height: textoLayout.height }
            : undefined
        }
        aria-hidden={aba === 'foto'}
      >
        {aba === 'texto' && textoLayout ? (
          <div
            ref={textoToolbarRef}
            className="pointer-events-auto flex shrink-0 items-center justify-end border-b border-gray-100 px-2 py-1.5"
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void handleSubmit('texto')}
              disabled={!texto.trim() || loading}
              className="rounded-lg bg-[#0097b2] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? '…' : 'Postar'}
            </button>
          </div>
        ) : null}
        <textarea
          ref={textareaTextoRef}
          value={texto}
          onChange={onTextoChange}
          onBlur={onTextoBlur}
          readOnly={aba === 'foto'}
          tabIndex={aba === 'texto' ? 0 : -1}
          placeholder="O que você está pensando?"
          name="criar-post-texto"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          className={`pointer-events-auto min-h-0 w-full flex-1 resize-none bg-white px-3 py-2 text-base font-bold leading-relaxed text-[#0097b2] placeholder:font-bold placeholder:text-[#0097b2]/45 focus:outline-none focus:ring-0 ${aba === 'texto' && textoLayout ? '' : 'min-h-0 p-0'}`}
          style={{
            overflowY: aba === 'texto' ? 'auto' : 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'manipulation',
          }}
        />
      </div>
    </div>
  )
}

export default function CriarPublicacaoPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-gray-50" />}>
      <CriarPublicacaoPageInner />
    </Suspense>
  )
}
