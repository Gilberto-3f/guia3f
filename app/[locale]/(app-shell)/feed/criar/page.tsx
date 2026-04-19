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
import { Camera, X } from 'lucide-react'
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

function daUrlParaAba(sp: ReturnType<typeof useSearchParams>): Aba {
  return sp.get('aba') === 'foto' ? 'foto' : 'texto'
}

function CriarPublicacaoPageInner() {
  const router = useRouter()
  const nextRouter = useNextRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [aba, setAba] = useState<Aba>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('aba') === 'foto'
      ? 'foto'
      : 'texto'
  )

  const sincronizarUrlComAba = useCallback(
    (next: Aba) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'foto') params.set('aba', 'foto')
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
  const [sheetOrigemFotoAberto, setSheetOrigemFotoAberto] = useState(false)

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

  /** Action sheet iOS: fechar com Escape e bloquear scroll do body. */
  useEffect(() => {
    if (!sheetOrigemFotoAberto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOrigemFotoAberto(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [sheetOrigemFotoAberto])

  const abrirSheetEscolherOrigem = useCallback(() => {
    setSheetOrigemFotoAberto(true)
  }, [])

  const fecharSheetEscolherOrigem = useCallback(() => {
    setSheetOrigemFotoAberto(false)
  }, [])

  const escolherOrigemFoto = useCallback(
    (input: HTMLInputElement | null) => {
      fecharSheetEscolherOrigem()
      dispararSeletorFicheiro(input)
    },
    [dispararSeletorFicheiro, fecharSheetEscolherOrigem]
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

  const podeIrParaTexto = aba !== 'foto' || fotoPreview != null

  /** Até medir o header: área visível grande (evita painel 1×1px — iOS não abre teclado). SSR-safe. */
  const estiloPainelTexto =
    aba === 'texto'
      ? textoLayout
        ? { top: textoLayout.top, height: textoLayout.height }
        : { top: '3.5rem', height: 'calc(100dvh - 3.5rem)' }
      : undefined

  const fundoPagina =
    aba === 'foto' && !fotoPreview
      ? 'bg-gradient-to-b from-[#e8f2ff] via-[#fff8ee] to-[#e5f5ed]'
      : 'bg-gray-50'

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
            className={tabCls(aba === 'texto')}
            onClick={irParaTexto}
            disabled={!podeIrParaTexto}
            onPointerDown={(e) => {
              if (aba === 'texto') e.preventDefault()
            }}
          >
            TEXTO
          </button>
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
        </div>
      </div>

      {aba === 'foto' ? (
        <div className="relative flex flex-1 flex-col px-3 pt-2 pb-2 sm:px-4">
          {!fotoPreview ? (
            <>
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#75AADB]/25 blur-3xl" />
                <div className="absolute -right-16 top-32 h-48 w-48 rounded-full bg-[#FDB913]/30 blur-3xl" />
                <div className="absolute bottom-24 left-1/3 h-40 w-40 rounded-full bg-[#00875A]/20 blur-3xl" />
              </div>

              <div className="relative z-0 flex flex-1 flex-col">
                <div className="mb-5 text-center">
                  <div className="mb-3 flex justify-center">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg ring-2 ring-white/80">
                      <Camera className="h-8 w-8 text-[#2C5F9A]" strokeWidth={1.75} aria-hidden />
                    </div>
                  </div>
                  <h1 className="mx-auto max-w-[20rem] text-balance text-xl font-bold leading-snug tracking-tight sm:text-2xl">
                    <span className="bg-gradient-to-r from-[#00875A] via-[#C9A008] to-[#2C5F9A] bg-clip-text text-transparent">
                      Compartilhe seu momento na Tríplice Fronteira
                    </span>
                  </h1>
                  <p className="mt-2 text-sm font-semibold text-[#5e5b60]">
                    Mostre o que você está vivendo agora <span aria-hidden>✨</span>
                  </p>
                  <div
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-lg shadow-sm"
                    aria-label="Brasil, Argentina e Paraguai"
                  >
                    <span aria-hidden>🇧🇷</span>
                    <span aria-hidden>🇦🇷</span>
                    <span aria-hidden>🇵🇾</span>
                  </div>
                </div>

                <div className="mb-6 rounded-[1.35rem] border border-[#FDB913]/35 bg-gradient-to-br from-[#fffdf8] to-[#fff3e0] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                  <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-left sm:justify-between">
                    <p className="text-center text-[15px] font-semibold text-[#2b2b2e] sm:text-left">
                      Fotos, experiências e descobertas em um só lugar
                    </p>
                    <span className="rounded-full bg-[#FDB913]/25 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[#7a5d00]">
                      inspire-se
                    </span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {[
                      {
                        key: 'br',
                        label: 'Brasil',
                        flag: '🇧🇷',
                        className:
                          'bg-gradient-to-br from-[#009c3b] via-[#ffdf00] to-[#002776]',
                      },
                      {
                        key: 'ar',
                        label: 'Argentina',
                        flag: '🇦🇷',
                        className: 'bg-gradient-to-br from-[#75AADB] via-white to-[#75AADB]',
                      },
                      {
                        key: 'py',
                        label: 'Paraguai',
                        flag: '🇵🇾',
                        className: 'bg-gradient-to-br from-[#d52b1e] via-white to-[#0038a8]',
                      },
                      {
                        key: 'marco',
                        label: 'Marco 3 Fronteiras',
                        flag: '🌉',
                        className: 'bg-gradient-to-br from-[#00875A] to-[#2C5F9A]',
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className={`relative h-[5.5rem] min-w-[6.25rem] shrink-0 overflow-hidden rounded-2xl shadow-md ring-1 ring-black/10 ${item.className}`}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
                        <span className="absolute left-2 top-2 text-xl drop-shadow">{item.flag}</span>
                        <span className="absolute bottom-2 left-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-center text-[10px] font-bold text-white backdrop-blur-sm">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-xs font-medium text-[#7b6e5a]">
                    Compartilhe a magia de Foz, Puerto Iguazú e Ciudad del Este
                  </p>
                </div>

                <div className="mt-auto space-y-2">
                  <button
                    type="button"
                    onClick={abrirSheetEscolherOrigem}
                    className="flex w-full items-center justify-center gap-2 rounded-[60px] bg-gradient-to-r from-[#00875A] to-[#2C5F9A] py-4 text-base font-bold text-white shadow-[0_10px_24px_-6px_rgba(0,135,90,0.45)] transition active:scale-[0.98]"
                  >
                    <Camera className="h-5 w-5 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
                    POSTAR FOTO
                  </button>
                  <p className="text-center text-xs text-[#8e8e93]">
                    Toque para escolher fototeca, câmera ou arquivo
                  </p>
                </div>
              </div>

              <div
                role="presentation"
                className={`fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-[6px] transition-opacity duration-200 ${
                  sheetOrigemFotoAberto ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                }`}
                aria-hidden={!sheetOrigemFotoAberto}
                onClick={fecharSheetEscolherOrigem}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="sheet-origem-foto-titulo"
                  className={`w-full max-w-lg transform rounded-t-[1.25rem] bg-[#f2f2f7] px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] transition-transform duration-200 ease-out ${
                    sheetOrigemFotoAberto ? 'translate-y-0' : 'translate-y-full'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p id="sheet-origem-foto-titulo" className="sr-only">
                    Escolher origem da foto
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      className="w-full rounded-[14px] bg-white py-3.5 text-[17px] font-medium text-[#007aff] shadow-sm active:bg-[#e5e5ea]"
                      onClick={() => escolherOrigemFoto(inputFototecaRef.current)}
                    >
                      <span className="mr-2 inline" aria-hidden>
                        📸
                      </span>
                      Fototeca
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-[14px] bg-white py-3.5 text-[17px] font-medium text-[#007aff] shadow-sm active:bg-[#e5e5ea]"
                      onClick={() => escolherOrigemFoto(inputCameraRef.current)}
                    >
                      <span className="mr-2 inline" aria-hidden>
                        📷
                      </span>
                      Tirar foto
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-[14px] bg-white py-3.5 text-[17px] font-medium text-[#007aff] shadow-sm active:bg-[#e5e5ea]"
                      onClick={() => escolherOrigemFoto(inputArquivoRef.current)}
                    >
                      <span className="mr-2 inline" aria-hidden>
                        📁
                      </span>
                      Escolher arquivo
                    </button>
                  </div>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-[14px] bg-white py-3.5 text-[17px] font-semibold text-[#007aff] shadow-sm active:bg-[#e5e5ea]"
                    onClick={fecharSheetEscolherOrigem}
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
