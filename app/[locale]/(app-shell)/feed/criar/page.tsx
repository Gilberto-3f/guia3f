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
import { Camera, FileText, Images, Ratio } from 'lucide-react'
import CriarFotoDreamBackdrop from '@/components/feed/CriarFotoDreamBackdrop'
import CriarPostRecorteMovel from '@/components/feed/CriarPostRecorteMovel'
import { supabase } from '@/lib/supabase'
import { getCroppedImageBlob, type PixelCrop } from '@/lib/cropImage'

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
  return `flex-1 py-3 text-center text-sm font-bold tracking-wide transition-colors ${
    ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-[#0097b2]/55'
  }`
}

/** Padrão: FOTO. Aba texto só com `?aba=texto`. */
function daUrlParaAba(sp: ReturnType<typeof useSearchParams>): Aba {
  return sp.get('aba') === 'texto' ? 'texto' : 'foto'
}

/** Reserva espaço para a `BottomBar` fixa (`pb-14` ≈ 3.5rem) no painel TEXTO. */
const ALTURA_BARRA_INFERIOR_APP_PX = 56

/** Galeria 2×2 em `/public/triple-frontier` (ficheiros 1, 2 e 4 substituídos por imagens temáticas; 3 mantém culinária). */
const INSPIRACAO_TRIPLA = [
  { src: '/triple-frontier/cataratas.jpg', alt: 'Cataratas do Iguaçu' },
  { src: '/triple-frontier/ponte-amizade.jpg', alt: 'Ponte da Amizade — fronteira entre Brasil e Paraguai' },
  { src: '/triple-frontier/culinaria-brasileira.jpg', alt: 'Culinária brasileira' },
  { src: '/triple-frontier/arara.jpg', alt: 'Arara-vermelha — fauna da região' },
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

  /** Só aplica `aba` a partir da URL quando `?aba=` muda de facto (evita resets por re-render do `searchParams`). */
  const ultimoParamAbaRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const raw = searchParams.get('aba')
    const chave = raw ?? ''
    if (ultimoParamAbaRef.current === chave) return
    ultimoParamAbaRef.current = chave
    setAba(daUrlParaAba(searchParams))
  }, [searchParams])

  /**
   * iOS: ao fechar o seletor de fotos, um toque residual pode acionar o botão da aba TEXTO.
   * Bloqueia `irParaTexto` por um instante após abrir o `<input type="file">`.
   */
  const ignorarIrParaTextoAteRef = useRef(0)

  const irParaFoto = useCallback(() => {
    flushSync(() => setAba('foto'))
    sincronizarUrlComAba('foto')
    queueMicrotask(() => {
      navegandoParaFotoRef.current = false
    })
  }, [sincronizarUrlComAba])

  const irParaTexto = useCallback(() => {
    if (performance.now() < ignorarIrParaTextoAteRef.current) return
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
  /** `null` até o utilizador escolher explicitamente (regra do botão Publicar). */
  const [formatoFoto, setFormatoFoto] = useState<FormatoFoto | null>(null)
  const [painelFormato, setPainelFormato] = useState(false)
  const [painelDescricao, setPainelDescricao] = useState(false)
  const [pixelCrop, setPixelCrop] = useState<PixelCrop | null>(null)
  const [textoLayout, setTextoLayout] = useState<{ top: number; height: number } | null>(null)
  /** Sincronizado com `guia-criar-keyboard`: quando a barra some, o painel TEXTO pode usar toda a altura útil. */
  const [barraInferiorOculta, setBarraInferiorOculta] = useState(false)

  const abaRef = useRef<Aba>(aba)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const publicarTextoBarRef = useRef<HTMLDivElement | null>(null)
  const navegandoParaFotoRef = useRef(false)
  /** Fototeca / galeria (sem `capture`); no iOS o seletor nativo reúne outras origens. */
  const inputFototecaRef = useRef<HTMLInputElement | null>(null)
  const textareaTextoRef = useRef<HTMLTextAreaElement | null>(null)

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
    setFormatoFoto(null)
    setPainelFormato(false)
    setPainelDescricao(false)
    setPixelCrop(null)
  }

  const dispararSeletorFicheiro = useCallback((input: HTMLInputElement | null) => {
    if (!input) return
    ignorarIrParaTextoAteRef.current = performance.now() + 650
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

  const onPixelCropChange = useCallback((c: PixelCrop | null) => {
    setPixelCrop(c)
  }, [])

  useEffect(() => {
    abaRef.current = aba
  }, [aba])

  useEffect(() => {
    if (!pathname.includes('/feed/criar')) setBarraInferiorOculta(false)
  }, [pathname])

  useEffect(() => {
    const onKb = (e: Event) => {
      const d = (e as CustomEvent<{ hide?: boolean }>).detail
      setBarraInferiorOculta(!!d?.hide)
    }
    window.addEventListener('guia-criar-keyboard', onKb as EventListener)
    return () => window.removeEventListener('guia-criar-keyboard', onKb as EventListener)
  }, [])

  /** Esconder BottomBar no AppShell quando o teclado está visível (TEXTO ou legenda na FOTO). */
  useEffect(() => {
    const emit = (hide: boolean) => {
      window.dispatchEvent(new CustomEvent('guia-criar-keyboard', { detail: { hide } }))
    }

    const monitorarTeclado =
      aba === 'texto' || (aba === 'foto' && painelDescricao && Boolean(fotoPreview))

    if (!monitorarTeclado) {
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
  }, [aba, painelDescricao, fotoPreview])

  const abrirSeletorFotoNativo = useCallback(() => {
    dispararSeletorFicheiro(inputFototecaRef.current)
  }, [dispararSeletorFicheiro])

  const atualizarLayoutTexto = useCallback(() => {
    if (abaRef.current !== 'texto') return
    const header = headerRef.current
    if (!header) return
    const vv = window.visualViewport
    const headerBottom = header.getBoundingClientRect().bottom
    const areaVisivelInferior = vv ? vv.offsetTop + vv.height : window.innerHeight
    const reservaBarra = barraInferiorOculta ? 0 : ALTURA_BARRA_INFERIOR_APP_PX
    const height = Math.max(96, Math.floor(areaVisivelInferior - headerBottom - reservaBarra))
    const top = Math.floor(headerBottom)

    setTextoLayout((prev) => {
      if (prev?.top === top && prev?.height === height) return prev
      return { top, height }
    })
  }, [barraInferiorOculta])

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
      const reservaBarra = barraInferiorOculta ? 0 : ALTURA_BARRA_INFERIOR_APP_PX
      const height = Math.max(96, Math.floor(areaVisivelInferior - headerBottom - reservaBarra))
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
  }, [aba, focarTextarea, barraInferiorOculta])

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
  }, [aba, atualizarLayoutTexto, focarTextarea, barraInferiorOculta])

  /** Chrome: teclado sobrepõe o layout em vez de redimensionar a viewport (evita empurrar a barra inferior). */
  useEffect(() => {
    if (aba !== 'texto') return
    const nav = navigator as Navigator & { virtualKeyboard?: { overlaysContent?: boolean } }
    const vk = nav.virtualKeyboard
    if (!vk || typeof vk.overlaysContent !== 'boolean') return
    try {
      const prev = vk.overlaysContent
      vk.overlaysContent = true
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
    if (origem === 'foto') {
      if (!fotoPreview || formatoFoto == null || !pixelCrop) return
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

      if (origem === 'foto' && fotoPreview && formatoFoto != null && pixelCrop) {
        const meta = FORMATOS[formatoFoto]
        const blob = await getCroppedImageBlob(
          fotoPreview,
          pixelCrop,
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
    <div className="mb-1.5 mt-4 flex w-full flex-nowrap gap-1.5 sm:gap-2">
      {(Object.keys(FORMATOS) as FormatoFoto[]).map((key) => {
        const f = FORMATOS[key]
        const ativo = formatoFoto === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFormatoFoto(key)
            }}
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

  return (
    <div
      className={`relative isolate flex min-h-[100dvh] flex-col overflow-hidden ${
        aba === 'foto'
          ? 'bg-[#f0f9ff]'
          : 'bg-gradient-to-br from-[#faf8f3] from-[12%] via-white via-[48%] to-stone-300'
      } ${aba === 'texto' ? 'pb-0' : ''}`}
    >
      {aba === 'foto' ? (
        <CriarFotoDreamBackdrop />
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_58%_at_50%_-8%,rgba(255,255,255,0.82),transparent_56%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_0%_100%,rgba(214,211,209,0.38),transparent_44%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_100%_28%,rgba(245,240,232,0.5),transparent_40%)]"
            aria-hidden
          />
        </>
      )}
      <input
        ref={inputFototecaRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Escolher foto na fototeca"
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
        <div
          className={`relative flex min-h-0 flex-col px-2 pt-0 sm:px-3 ${fotoPreview ? 'min-h-0 flex-1' : ''}`}
        >
          {!fotoPreview ? (
            <>
              <div className="relative flex min-h-0 flex-none flex-col overflow-y-auto px-0.5 pb-0 pt-1 text-center sm:px-1.5">
                <div className="flex w-full min-w-0 shrink-0 flex-col items-center">
                  <Camera
                    size={48}
                    strokeWidth={2}
                    className="mx-auto mb-2 shrink-0 text-gray-700"
                    aria-hidden
                  />

                  <h1 className="mx-auto mb-3 flex min-w-0 w-full max-w-full flex-col items-center gap-1.5 px-0 text-center sm:gap-2 sm:px-0.5">
                    <span className="block w-full max-w-[20rem] font-normal leading-snug tracking-tight text-gray-700 text-[clamp(0.95rem,2.9vw+0.48rem,1.18rem)] sm:max-w-none">
                      Compartilhe seu momento
                    </span>
                    <span className="block w-full max-w-[20rem] font-normal leading-snug tracking-tight text-gray-800 text-[clamp(1.2rem,4.8vw+0.55rem,1.72rem)] sm:max-w-none sm:text-[clamp(1.35rem,5.2vw+0.6rem,1.95rem)]">
                      na Tríplice Fronteira
                    </span>
                  </h1>

                  <div className="mx-auto mt-1 w-full max-w-[280px] shrink-0 pb-0 sm:max-w-xs">
                    <div className="grid grid-cols-2 gap-3">
                    {INSPIRACAO_TRIPLA.map((item, i) => (
                      <div
                        key={item.src}
                        className="relative aspect-square w-full overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5"
                      >
                        <Image
                          src={item.src}
                          alt={item.alt}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 45vw, 200px"
                          priority={i === 0}
                        />
                      </div>
                    ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={abrirSeletorFotoNativo}
                    className="mx-auto mt-6 flex w-[min(100%,220px)] min-w-[200px] items-center justify-center gap-2 rounded-xl bg-[#00cf42] px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-[#00b83a] active:bg-[#009e32]"
                  >
                    <Camera size={18} strokeWidth={2.25} className="shrink-0" aria-hidden />
                    Publicar Foto
                  </button>

                  <p className="mx-auto mt-5 max-w-md px-1 text-base font-normal text-gray-600 sm:mt-6">
                    Mostre o que você está vivendo agora
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative w-full shrink-0">
                <CriarPostRecorteMovel
                  key={fotoPreview}
                  imageSrc={fotoPreview}
                  aspect={formatoFoto != null ? FORMATOS[formatoFoto].aspect : 1}
                  ativo={formatoFoto != null}
                  onPixelCropChange={onPixelCropChange}
                />
              </div>

              <div className="mt-2 flex w-full gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPainelFormato((p) => !p)
                    setPainelDescricao(false)
                  }}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-[#0097b2] py-2 text-center text-[11px] font-bold leading-tight text-white shadow-sm transition hover:opacity-95 active:opacity-90 sm:py-2.5 sm:text-sm"
                  aria-expanded={painelFormato}
                >
                  <Ratio size={16} className="shrink-0 opacity-95 sm:h-[18px] sm:w-[18px]" aria-hidden />
                  Formato
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPainelDescricao((p) => !p)
                    setPainelFormato(false)
                  }}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-[#0097b2] py-2 text-center text-[11px] font-bold leading-tight text-white shadow-sm transition hover:opacity-95 active:opacity-90 sm:py-2.5 sm:text-sm"
                  aria-expanded={painelDescricao}
                >
                  <FileText size={16} className="shrink-0 opacity-95 sm:h-[18px] sm:w-[18px]" aria-hidden />
                  Descrição
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPainelFormato(false)
                    setPainelDescricao(false)
                    dispararSeletorFicheiro(inputFototecaRef.current)
                  }}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-[#0097b2] py-2 text-center text-[11px] font-bold leading-tight text-white shadow-sm transition hover:opacity-95 active:opacity-90 sm:py-2.5 sm:text-sm"
                >
                  <Images size={16} className="shrink-0 opacity-95 sm:h-[18px] sm:w-[18px]" aria-hidden />
                  Galeria
                </button>
              </div>

              {painelFormato ? formatosRow : null}

              {painelDescricao ? (
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Legenda (opcional)..."
                  className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-base font-bold whitespace-pre-wrap text-black placeholder:font-bold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                  rows={4}
                />
              ) : null}

              <button
                type="button"
                onClick={() => void handleSubmit('foto')}
                disabled={!fotoPreview || formatoFoto == null || !pixelCrop || loading}
                className="mt-2 w-full rounded-xl bg-emerald-600 py-3 text-center text-base font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
              >
                {loading ? 'Postando...' : 'Publicar'}
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
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-gradient-to-br from-[#faf8f3] from-[12%] via-white via-[48%] to-stone-300" />
      }
    >
      <CriarPublicacaoPageInner />
    </Suspense>
  )
}
