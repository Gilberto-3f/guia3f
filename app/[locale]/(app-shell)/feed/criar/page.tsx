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
import Image from 'next/image'
import { useRouter } from '@/i18n/navigation'
import { Camera, FolderOpen, Images, X } from 'lucide-react'
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

/** Padrão: FOTO. Aba texto só com `?aba=texto`. */
function daUrlParaAba(sp: ReturnType<typeof useSearchParams>): Aba {
  return sp.get('aba') === 'texto' ? 'texto' : 'foto'
}

/** Fotos locais em /public/triple-frontier (stock; substituir por fotos próprias se quiser). */
const INSPIRACAO_TRIPLA = [
  { src: '/triple-frontier/cataratas.jpg', alt: 'Cataratas do Iguaçu' },
  { src: '/triple-frontier/ponte-amizade.jpg', alt: 'Ponte da Amizade - Brasil/Paraguai' },
  { src: '/triple-frontier/culinaria-brasileira.jpg', alt: 'Culinária brasileira' },
  { src: '/triple-frontier/arara.jpg', alt: 'Arara - fauna da região' },
] as const

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
    queueMicrotask(() => {
      navegandoParaFotoRef.current = false
    })
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
  const [textoLayout, setTextoLayout] = useState<{ top: number; height: number } | null>(null)

  const abaRef = useRef<Aba>(aba)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const publicarTextoBarRef = useRef<HTMLDivElement | null>(null)
  const navegandoParaFotoRef = useRef(false)
  const inputFototecaRef = useRef<HTMLInputElement | null>(null)
  const inputCameraRef = useRef<HTMLInputElement | null>(null)
  const inputArquivoRef = useRef<HTMLInputElement | null>(null)
  const textareaTextoRef = useRef<HTMLTextAreaElement | null>(null)
  const fotoPreviewRef = useRef<string | null>(null)
  const [actionSheetAberto, setActionSheetAberto] = useState(false)

  const limparFoto = useCallback(() => {
    setFotoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }, [])

  const onFotoSelecionada = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Para publicar no feed, escolha um ficheiro de imagem.')
      return
    }
    setFotoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const dispararSeletorFicheiro = useCallback((input: HTMLInputElement | null) => {
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

  useEffect(() => {
    fotoPreviewRef.current = fotoPreview
  }, [fotoPreview])

  useEffect(() => {
    const onCancel = () => {
      if (abaRef.current !== 'foto' || fotoPreviewRef.current) return
      irParaTexto()
    }
    const attached: HTMLInputElement[] = []
    for (const r of [inputFototecaRef, inputCameraRef, inputArquivoRef]) {
      const el = r.current
      if (el) {
        el.addEventListener('cancel', onCancel)
        attached.push(el)
      }
    }
    return () => attached.forEach((el) => el.removeEventListener('cancel', onCancel))
  }, [irParaTexto])

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

  /** Informa o AppShell: esconder BottomBar só com teclado aberto na aba TEXTO. */
  useEffect(() => {
    const emit = (hide: boolean) => {
      window.dispatchEvent(new CustomEvent('guia-criar-keyboard', { detail: { hide } }))
    }
    if (aba !== 'texto') {
      emit(false)
      return
    }

    const check = () => {
      const vv = window.visualViewport
      if (!vv) {
        emit(false)
        return
      }
      const delta = window.innerHeight - vv.height
      emit(delta > 110)
    }

    check()
    const vv = window.visualViewport
    vv?.addEventListener('resize', check)
    vv?.addEventListener('scroll', check)
    window.addEventListener('resize', check)

    return () => {
      vv?.removeEventListener('resize', check)
      vv?.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      emit(false)
    }
  }, [aba])

  /** Action sheet iOS: fechar com Escape e bloquear scroll do body. */
  useEffect(() => {
    if (!actionSheetAberto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionSheetAberto(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [actionSheetAberto])

  const abrirActionSheet = useCallback(() => {
    setActionSheetAberto(true)
  }, [])

  const fecharActionSheet = useCallback(() => {
    setActionSheetAberto(false)
  }, [])

  const escolherOrigemFoto = useCallback(
    (input: HTMLInputElement | null) => {
      fecharActionSheet()
      dispararSeletorFicheiro(input)
    },
    [dispararSeletorFicheiro, fecharActionSheet]
  )

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
    const run = () =>
      requestAnimationFrame(() => {
        atualizarLayoutTexto()
        if (abaRef.current !== 'texto') return
        const ta = textareaTextoRef.current
        if (ta && document.activeElement !== ta) focarTextarea()
      })

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
    const focusDelaysMs = [0, 50, 120, 250, 450, 700]
    const timers = focusDelaysMs.map((ms) => window.setTimeout(focusTexto, ms))

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
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [aba, atualizarLayoutTexto, focarTextarea])

  /** Chrome: redimensionar a viewport com o teclado (melhor alinhamento ao visualViewport). */
  useEffect(() => {
    if (aba !== 'texto') return
    const nav = navigator as Navigator & { virtualKeyboard?: { overlaysContent?: boolean } }
    const vk = nav.virtualKeyboard
    if (!vk || typeof vk.overlaysContent !== 'boolean') return
    try {
      const prev = vk.overlaysContent
      vk.overlaysContent = false
      return () => {
        try {
          vk.overlaysContent = prev
        } catch {
          /* noop */
        }
      }
    } catch {
      /* noop */
    }
  }, [aba])

  const onTextoBlur = useCallback(
    (e: FocusEvent<HTMLTextAreaElement>) => {
      if (abaRef.current !== 'texto') return
      if (navegandoParaFotoRef.current) return
      const alvo = e.relatedTarget
      if (alvo instanceof Node) {
        if (headerRef.current?.contains(alvo)) return
        if (publicarTextoBarRef.current?.contains(alvo)) return
      }
      const refocar = () => {
        if (abaRef.current !== 'texto') return
        if (navegandoParaFotoRef.current) return
        const active = document.activeElement
        if (active && headerRef.current?.contains(active)) return
        if (active && publicarTextoBarRef.current?.contains(active)) return
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

  /** Até medir o header: área visível grande (evita painel 1×1px — iOS não abre teclado). SSR-safe. */
  const estiloPainelTexto =
    aba === 'texto'
      ? textoLayout
        ? { top: textoLayout.top, height: textoLayout.height }
        : { top: '3.5rem', height: 'calc(100dvh - 3.5rem)' }
      : undefined

  const fundoPagina = 'bg-gray-50'

  return (
    <div
      className={`flex min-h-[100dvh] flex-col ${fundoPagina} ${aba === 'texto' ? 'pb-0' : ''}`}
      style={
        aba === 'foto'
          ? { paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }
          : undefined
      }
    >
      <input
        ref={inputFototecaRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Fototeca"
        onChange={onFotoSelecionada}
      />
      <input
        ref={inputCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Tirar foto"
        onChange={onFotoSelecionada}
      />
      <input
        ref={inputArquivoRef}
        type="file"
        accept="*/*"
        className="sr-only"
        aria-label="Escolher ficheiro"
        onChange={onFotoSelecionada}
      />

      <div
        ref={headerRef}
        className="sticky top-0 z-30 flex items-stretch justify-between gap-2 border-b border-gray-200 bg-white shadow-sm"
        data-criar-header
      >
        <div className="flex min-w-0 flex-1">
          <button
            type="button"
            className={tabCls(aba === 'foto')}
            onPointerDownCapture={() => {
              navegandoParaFotoRef.current = true
            }}
            onClick={() => irParaFoto()}
          >
            FOTO
          </button>
          <button
            type="button"
            className={tabCls(aba === 'texto')}
            onClick={irParaTexto}
            onPointerDown={(e) => {
              if (aba === 'texto') e.preventDefault()
            }}
          >
            TEXTO
          </button>
        </div>
      </div>

      {aba === 'foto' ? (
        <div className="relative flex flex-1 flex-col px-2 pb-2 pt-1 sm:px-3">
          {!fotoPreview ? (
            <>
              <div className="relative flex min-h-[min(76dvh,680px)] flex-1 flex-col overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5 sm:rounded-3xl">
                {/* Fundo claro + blobs (aquarela / névoa) */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-white via-[#F5FDFF] to-[#FFF8E8]"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -left-[18%] -top-[12%] h-[58%] w-[58%] rounded-full bg-[radial-gradient(circle,rgba(178,235,242,0.55)_0%,transparent_68%)] blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -bottom-[20%] -right-[12%] h-[52%] w-[52%] rounded-full bg-[radial-gradient(circle,rgba(255,248,225,0.55)_0%,transparent_70%)] blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute left-1/3 top-1/2 h-[40%] w-[45%] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(224,247,250,0.45)_0%,transparent_65%)] blur-3xl"
                  aria-hidden
                />

                <div className="relative z-10 flex flex-1 flex-col items-center px-4 pb-8 pt-8 text-center sm:px-6">
                  <Camera
                    size={48}
                    strokeWidth={1.75}
                    className="mx-auto mb-4 shrink-0 text-[#0097b2]"
                    aria-hidden
                  />

                  <h1 className="mx-auto mb-2 max-w-[20rem] text-balance text-2xl font-bold leading-snug text-[#1F2937]">
                    Compartilhe seu momento na Tríplice Fronteira
                  </h1>
                  <p className="mb-6 max-w-md text-base font-normal text-gray-500">
                    Mostre o que você está vivendo agora
                  </p>

                  <button
                    type="button"
                    onClick={abrirActionSheet}
                    className="mx-auto flex w-[min(100%,220px)] min-w-[200px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4CAF50] to-[#0097b2] px-6 py-3 text-base font-semibold text-white shadow-md transition hover:opacity-90 active:opacity-95"
                  >
                    <Camera size={18} strokeWidth={2.25} className="shrink-0" aria-hidden />
                    Publicar Foto
                  </button>

                  <div className="mt-6 mb-6 w-full max-w-md">
                    <div className="flex gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {INSPIRACAO_TRIPLA.map((item, i) => (
                        <div
                          key={item.src}
                          className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5"
                        >
                          <Image
                            src={item.src}
                            alt={item.alt}
                            fill
                            className="object-cover"
                            sizes="120px"
                            priority={i === 0}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="mt-4 flex justify-center gap-4"
                    aria-label="Brasil, Paraguai e Argentina"
                  >
                    <span className="text-3xl leading-none" title="Brasil" aria-hidden>
                      🇧🇷
                    </span>
                    <span className="text-3xl leading-none" title="Paraguai" aria-hidden>
                      🇵🇾
                    </span>
                    <span className="text-3xl leading-none" title="Argentina" aria-hidden>
                      🇦🇷
                    </span>
                  </div>
                </div>
              </div>

              <div
                role="presentation"
                className={`fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
                  actionSheetAberto ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                }`}
                aria-hidden={!actionSheetAberto}
                onClick={fecharActionSheet}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="sheet-origem-foto-titulo"
                  className={`w-full max-w-lg transform rounded-t-[1.25rem] bg-[#f2f2f7] px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] transition-transform duration-200 ease-out ${
                    actionSheetAberto ? 'translate-y-0' : 'translate-y-full'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p id="sheet-origem-foto-titulo" className="sr-only">
                    Escolher origem da foto
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-white py-3.5 text-[17px] font-medium text-[#007aff] shadow-sm active:bg-[#e5e5ea]"
                      onClick={() => escolherOrigemFoto(inputFototecaRef.current)}
                    >
                      <Images className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                      Fototeca
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-white py-3.5 text-[17px] font-medium text-[#007aff] shadow-sm active:bg-[#e5e5ea]"
                      onClick={() => escolherOrigemFoto(inputCameraRef.current)}
                    >
                      <Camera className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                      Tirar foto
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-white py-3.5 text-[17px] font-medium text-[#007aff] shadow-sm active:bg-[#e5e5ea]"
                      onClick={() => escolherOrigemFoto(inputArquivoRef.current)}
                    >
                      <FolderOpen className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                      Escolher arquivo
                    </button>
                  </div>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-[14px] bg-white py-3.5 text-[17px] font-semibold text-red-500 shadow-sm active:bg-[#e5e5ea]"
                    onClick={fecharActionSheet}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </>
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
                className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-base font-bold whitespace-pre-wrap text-black placeholder:font-bold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
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
          aba === 'texto'
            ? 'fixed left-0 right-0 z-20 flex min-h-0 min-w-0 flex-col border-t border-gray-100 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)]'
            : 'pointer-events-none fixed left-0 top-0 z-[-1] m-0 h-px max-h-[1px] w-px max-w-[1px] overflow-hidden border-0 p-0 opacity-0'
        }
        style={estiloPainelTexto}
        aria-hidden={aba === 'foto'}
      >
        <textarea
          ref={textareaTextoRef}
          value={texto}
          onChange={onTextoChange}
          onBlur={onTextoBlur}
          readOnly={aba === 'foto'}
          tabIndex={aba === 'texto' ? 0 : -1}
          autoFocus={aba === 'texto'}
          placeholder="O que você está pensando?"
          name="criar-post-texto"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck={true}
          inputMode="text"
          enterKeyHint="enter"
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          className={`pointer-events-auto min-h-0 w-full min-w-0 flex-1 resize-none bg-white px-3 py-2 text-base font-bold leading-relaxed text-black placeholder:font-bold placeholder:text-gray-400 focus:outline-none focus:ring-0 ${aba === 'texto' ? '' : 'min-h-0 p-0'}`}
          style={{
            overflowY: aba === 'texto' ? 'auto' : 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'manipulation',
            caretColor: '#000',
          }}
        />
        {aba === 'texto' ? (
          <div
            ref={publicarTextoBarRef}
            className="pointer-events-auto shrink-0 border-t border-gray-200 bg-white px-3 pt-2"
            style={{
              paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 8px))',
            }}
          >
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => void handleSubmit('texto')}
              disabled={!texto.trim() || loading}
              className="w-full rounded-xl bg-[#0097b2] py-3 text-center text-base font-bold text-white shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        ) : null}
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
