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
import { Great_Vibes } from 'next/font/google'
import { useRouter } from '@/i18n/navigation'
import { Camera, X } from 'lucide-react'
import CriarPostRecorteMovel from '@/components/feed/CriarPostRecorteMovel'
import { supabase } from '@/lib/supabase'
import { getCroppedImageBlob, type PixelCrop } from '@/lib/cropImage'

/** Estilo script próximo de “Benedict”; substituir por `next/font/local` se tiveres a fonte licenciada. */
const fontTripliceScript = Great_Vibes({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

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
  /** `null` até o utilizador escolher explicitamente (regra do botão Publicar). */
  const [formatoFoto, setFormatoFoto] = useState<FormatoFoto | null>(null)
  const [painelFormato, setPainelFormato] = useState(false)
  const [painelDescricao, setPainelDescricao] = useState(false)
  const [pixelCrop, setPixelCrop] = useState<PixelCrop | null>(null)
  const [textoLayout, setTextoLayout] = useState<{ top: number; height: number } | null>(null)

  const abaRef = useRef<Aba>(aba)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const publicarTextoBarRef = useRef<HTMLDivElement | null>(null)
  const navegandoParaFotoRef = useRef(false)
  /** Um único input: o SO mostra o seletor nativo (Safari/iOS). */
  const inputFotoRef = useRef<HTMLInputElement | null>(null)
  const textareaTextoRef = useRef<HTMLTextAreaElement | null>(null)
  const fotoPreviewRef = useRef<string | null>(null)

  const limparFoto = useCallback(() => {
    setFotoPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    setFormatoFoto(null)
    setPainelFormato(false)
    setPainelDescricao(false)
    setPixelCrop(null)
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
    setFormatoFoto(null)
    setPainelFormato(false)
    setPainelDescricao(false)
    setPixelCrop(null)
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
    for (const r of [inputFotoRef]) {
      const el = r.current
      if (el) {
        el.addEventListener('cancel', onCancel)
        attached.push(el)
      }
    }
    return () => attached.forEach((el) => el.removeEventListener('cancel', onCancel))
  }, [irParaTexto])

  const onPixelCropChange = useCallback((c: PixelCrop | null) => {
    setPixelCrop(c)
  }, [])

  useEffect(() => {
    abaRef.current = aba
  }, [aba])

  const abrirSeletorFotoNativo = useCallback(() => {
    dispararSeletorFicheiro(inputFotoRef.current)
  }, [dispararSeletorFicheiro])

  const atualizarLayoutTexto = useCallback(() => {
    if (abaRef.current !== 'texto') return
    const header = headerRef.current
    if (!header) return
    const vv = window.visualViewport
    const headerBottom = header.getBoundingClientRect().bottom
    const areaVisivelInferior = vv ? vv.offsetTop + vv.height : window.innerHeight
    const height = Math.max(96, Math.floor(areaVisivelInferior - headerBottom - ALTURA_BARRA_INFERIOR_APP_PX))
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
      const height = Math.max(96, Math.floor(areaVisivelInferior - headerBottom - ALTURA_BARRA_INFERIOR_APP_PX))
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

  const fundoPagina = 'bg-gray-50'

  return (
    <div className={`flex min-h-[100dvh] flex-col ${fundoPagina} ${aba === 'texto' ? 'pb-0' : ''}`}>
      <input
        ref={inputFotoRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Escolher foto para publicar"
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
              <div className="relative flex min-h-0 flex-none flex-col overflow-y-auto px-4 pb-0 pt-1 text-center sm:px-6">
                <div className="flex shrink-0 flex-col items-center">
                  <Camera
                    size={48}
                    strokeWidth={1.75}
                    className="mx-auto mb-2 shrink-0 text-[#0097b2]"
                    aria-hidden
                  />

                  <h1 className="mx-auto mb-3 flex min-w-0 max-w-full flex-col items-center gap-0.5 px-3 text-center text-[#1F2937] sm:px-5">
                    <span className="block w-full whitespace-nowrap text-[clamp(0.82rem,2.85vw+0.48rem,1.125rem)] font-bold leading-snug tracking-tight">
                      Compartilhe seu momento na
                    </span>
                    <span
                      className={`${fontTripliceScript.className} block w-full max-w-full whitespace-nowrap text-[clamp(1.7rem,8.2vw+0.55rem,4.35rem)] leading-[0.92] text-black`}
                    >
                      Tríplice Fronteira
                    </span>
                  </h1>

                  <button
                    type="button"
                    onClick={abrirSeletorFotoNativo}
                    className="mx-auto flex w-[min(100%,220px)] min-w-[200px] items-center justify-center gap-2 rounded-xl bg-[#0097b2] px-6 py-3 text-base font-semibold text-white shadow-md transition hover:opacity-90 active:opacity-95"
                  >
                    <Camera size={18} strokeWidth={2.25} className="shrink-0" aria-hidden />
                    Publicar Foto
                  </button>

                  <p className="mx-auto mt-3 max-w-md text-base font-normal text-gray-500">
                    Mostre o que você está vivendo agora
                  </p>

                  <div className="mx-auto mt-2 w-full max-w-[280px] shrink-0 pb-0 sm:max-w-xs">
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
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative w-full shrink-0">
                <button
                  type="button"
                  onClick={limparFoto}
                  className="absolute right-1 top-1 z-[2] rounded-full bg-black/50 p-1.5 text-white shadow-md"
                  aria-label="Remover foto e escolher outra"
                >
                  <X size={18} aria-hidden />
                </button>
                <CriarPostRecorteMovel
                  key={fotoPreview}
                  imageSrc={fotoPreview}
                  aspect={formatoFoto != null ? FORMATOS[formatoFoto].aspect : 1}
                  ativo={formatoFoto != null}
                  onPixelCropChange={onPixelCropChange}
                />
              </div>

              <div className="mt-2 flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPainelFormato((p) => !p)
                    setPainelDescricao(false)
                  }}
                  className="flex-1 rounded-xl bg-[#0097b2] py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:opacity-95 active:opacity-90"
                  aria-expanded={painelFormato}
                >
                  Formato
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPainelDescricao((p) => !p)
                    setPainelFormato(false)
                  }}
                  className="flex-1 rounded-xl bg-[#0097b2] py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:opacity-95 active:opacity-90"
                  aria-expanded={painelDescricao}
                >
                  Descrição
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
    <Suspense fallback={<div className="min-h-[100dvh] bg-gray-50" />}>
      <CriarPublicacaoPageInner />
    </Suspense>
  )
}
