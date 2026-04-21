'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Camera, Image as ImageIcon, Images } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import EditorStory from '@/components/EditorStory'
import PreviewStory from '@/components/PreviewStory'

const BG_CATARATAS = '/triple-frontier/cataratas.jpg'

/**
 * @param {{ autorTipo: 'turista' | 'profissional' | 'empresa' | string }} props
 */
export default function CriarStory({ autorTipo }) {
  const router = useRouter()
  const [passo, setPasso] = useState(/** @type {1 | 2 | 3} */ (1))
  const [file, setFile] = useState(/** @type {File | null} */ (null))
  const [previewBlob, setPreviewBlob] = useState(/** @type {string | null} */ (null))
  const [legenda, setLegenda] = useState('')
  const [posicao, setPosicao] = useState({ x: 50, y: 70 })
  const [posicaoLink, setPosicaoLink] = useState({ x: 50, y: 82 })
  const [fundo, setFundo] = useState({ scale: 1, pan_x_pct: 0, pan_y_pct: 0 })
  const [linkUrl, setLinkUrl] = useState('')
  const [publicando, setPublicando] = useState(false)

  const inputPrincipalRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const inputFotoRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const inputCameraRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const inputGaleriaRef = useRef(/** @type {HTMLInputElement | null} */ (null))

  /**
   * Apenas imagens (sem vídeo).
   * @param {File | null} f
   */
  const aplicarArquivo = (f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      alert('Selecione apenas uma imagem.')
      return
    }
    setFile(f)
    setPreviewBlob(URL.createObjectURL(f))
    setPasso(2)
  }

  const onFileChange = (e) => {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    aplicarArquivo(f)
  }

  const irRevisao = () => {
    if (!previewBlob) return
    setPasso(3)
  }

  const voltarAoInicio = () => {
    if (previewBlob) URL.revokeObjectURL(previewBlob)
    setPreviewBlob(null)
    setFile(null)
    setLegenda('')
    setPosicao({ x: 50, y: 70 })
    setPosicaoLink({ x: 50, y: 82 })
    setFundo({ scale: 1, pan_x_pct: 0, pan_y_pct: 0 })
    setLinkUrl('')
    setPasso(1)
  }

  const publicar = async () => {
    if (!file || !previewBlob) return
    setPublicando(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        alert('Faça login')
        return
      }

      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('stories').upload(path, file)
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('stories').getPublicUrl(path)
      const url = pub.publicUrl

      const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const { error: insErr } = await supabase.from('stories').insert({
        autor_id: session.user.id,
        autor_tipo: autorTipo,
        tipo: 'foto',
        conteudo_url: url,
        texto_sobreposto: {
          texto: legenda.trim() || null,
          posicao_x: posicao.x,
          posicao_y: posicao.y,
          link_posicao_x: posicaoLink.x,
          link_posicao_y: posicaoLink.y,
          fundo_scale: fundo.scale,
          fundo_pan_x_pct: fundo.pan_x_pct,
          fundo_pan_y_pct: fundo.pan_y_pct,
        },
        link: linkUrl.trim() || null,
        expira_em: expira,
        duracao_segundos: 60,
      })

      if (insErr) throw insErr

      router.push('/feed')
      router.refresh()
    } catch (e) {
      console.error(e)
      alert('Não foi possível publicar o story.')
    } finally {
      setPublicando(false)
    }
  }

  const textoSombreado = { textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 2px 12px rgba(0,0,0,0.45)' }

  return (
    <div className={passo === 1 ? 'min-h-[100dvh]' : 'min-h-screen bg-gray-50 pb-24'}>
      {passo === 1 ? (
        <div className="relative min-h-[100dvh] w-full overflow-hidden pb-24">
          <div className="pointer-events-none absolute inset-0 z-0">
            <Image src={BG_CATARATAS} alt="" fill className="object-cover object-center" sizes="100vw" priority />
          </div>
          <div className="pointer-events-none absolute inset-0 z-[1] bg-black/50" aria-hidden />

          <div className="relative z-10 flex min-h-[100dvh] flex-col px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl" style={textoSombreado}>
                Crie um Novo Story
              </h1>
              <p className="mt-3 max-w-sm text-base font-medium text-white sm:text-lg" style={textoSombreado}>
                Compartilhe fotos rapidinho!
              </p>

              <input
                ref={inputPrincipalRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Escolher imagem para criar story"
                onChange={onFileChange}
              />

              <button
                type="button"
                onClick={() => inputPrincipalRef.current?.click()}
                className="mt-8 rounded-lg bg-[#0097b2] px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:opacity-95 active:opacity-90"
              >
                Criar Story
              </button>
            </div>

            <div className="mt-auto flex w-full max-w-md justify-center gap-6 sm:gap-10">
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                capture="user"
                className="sr-only"
                aria-label="Tirar foto com a câmera frontal"
                onChange={onFileChange}
              />
              <button
                type="button"
                className="flex flex-col items-center gap-2 rounded-xl bg-transparent p-2 text-white transition hover:opacity-90"
                onClick={() => inputFotoRef.current?.click()}
              >
                <span className="flex h-12 w-12 items-center justify-center" aria-hidden>
                  <ImageIcon className="h-12 w-12" strokeWidth={1.5} />
                </span>
                <span className="text-xs font-semibold" style={textoSombreado}>
                  Foto
                </span>
              </button>

              <input
                ref={inputCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-label="Tirar foto com a câmera traseira"
                onChange={onFileChange}
              />
              <button
                type="button"
                className="flex flex-col items-center gap-2 rounded-xl bg-transparent p-2 text-white transition hover:opacity-90"
                onClick={() => inputCameraRef.current?.click()}
              >
                <span className="flex h-12 w-12 items-center justify-center" aria-hidden>
                  <Camera className="h-12 w-12" strokeWidth={1.5} />
                </span>
                <span className="text-xs font-semibold" style={textoSombreado}>
                  Câmera
                </span>
              </button>

              <input
                ref={inputGaleriaRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Escolher foto da galeria"
                onChange={onFileChange}
              />
              <button
                type="button"
                className="flex flex-col items-center gap-2 rounded-xl bg-transparent p-2 text-white transition hover:opacity-90"
                onClick={() => inputGaleriaRef.current?.click()}
              >
                <span className="flex h-12 w-12 items-center justify-center" aria-hidden>
                  <Images className="h-12 w-12" strokeWidth={1.5} />
                </span>
                <span className="text-xs font-semibold" style={textoSombreado}>
                  Galeria
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passo !== 1 ? (
        <div className="border-b border-gray-100 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (passo === 2 ? voltarAoInicio() : setPasso(2))}
              className="text-sm font-medium text-[#0097b2]"
            >
              ← Voltar
            </button>
            <h1 className="text-lg font-semibold text-gray-800">Editar story</h1>
          </div>
        </div>
      ) : null}

      <div className={passo === 1 ? 'hidden' : passo === 2 ? '' : 'p-4'}>
        {passo === 2 && previewBlob ? (
          <div className="flex h-[calc(100dvh-3.25rem)] min-h-[320px] flex-col sm:h-[calc(100dvh-3.5rem)]">
            <EditorStory
              mediaSrc={previewBlob}
              mediaKind="image"
              legenda={legenda}
              onLegendaChange={setLegenda}
              posicao={posicao}
              onPosicaoChange={setPosicao}
              posicaoLink={posicaoLink}
              onPosicaoLinkChange={setPosicaoLink}
              fundo={fundo}
              onFundoChange={setFundo}
              linkUrl={linkUrl}
              onLinkChange={setLinkUrl}
              onRevisar={irRevisao}
            />
          </div>
        ) : null}

        {passo === 3 && previewBlob ? (
          <PreviewStory
            mediaSrc={previewBlob}
            mediaKind="image"
            legenda={legenda}
            posicao={posicao}
            posicaoLink={posicaoLink}
            fundo={fundo}
            linkUrl={linkUrl}
            onVoltar={() => setPasso(2)}
            onPublicar={() => void publicar()}
            publicando={publicando}
          />
        ) : null}
      </div>
    </div>
  )
}
