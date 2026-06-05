'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useGateFeedSocial } from '@/lib/useGateFeedSocial'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { compressImageFileForStoryUpload } from '@/lib/compress-story-image'
import EditorStory from '@/components/EditorStory'

/**
 * @param {{ autorTipo: 'turista' | 'profissional' | 'empresa' | string }} props
 */
export default function CriarStory({ autorTipo }) {
  const router = useRouter()
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const {
    podeInteragirFeedSocial,
    avisarBloqueioFeed,
    avisoFeedAberto,
    fecharAvisoBloqueioFeed,
    mensagemBloqueioFeed,
    tituloBloqueioFeed,
    loading: gateFeedLoading,
  } = useGateFeedSocial()

  useEffect(() => {
    if (gateFeedLoading) return
    if (!podeInteragirFeedSocial) {
      avisarBloqueioFeed()
      router.replace('/feed')
    }
  }, [gateFeedLoading, podeInteragirFeedSocial, router])
  const [passo, setPasso] = useState(/** @type {1 | 2} */ (1))
  const [file, setFile] = useState(/** @type {File | null} */ (null))
  const [previewBlob, setPreviewBlob] = useState(/** @type {string | null} */ (null))
  const [legenda, setLegenda] = useState('')
  const [posicao, setPosicao] = useState({ x: 50, y: 70 })
  const [posicaoLink, setPosicaoLink] = useState({ x: 50, y: 82 })
  const [fundo, setFundo] = useState({ scale: 1, pan_x_pct: 0, pan_y_pct: 0 })
  const [textoScale, setTextoScale] = useState(1)
  const [linkUrl, setLinkUrl] = useState('')
  const [marcacoes, setMarcacoes] = useState(
    /** @type {{ usuario_id: string, username: string, tipo: string, nome?: string, foto_url?: string | null, empresa_id?: string | null, posicao_x?: number, posicao_y?: number }[]} */ ([])
  )
  const [publicando, setPublicando] = useState(false)

  const inputPrincipalRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  /** Galeria nativa (sem `capture`) — mesmo padrão do iOS ao “trocar foto” no editor. */
  const inputTrocarFotoRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const autoPickerRef = useRef({ startedAt: 0, opened: false })

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
    if (previewBlob) URL.revokeObjectURL(previewBlob)
    setFile(f)
    setPreviewBlob(URL.createObjectURL(f))
    setFundo({ scale: 1, pan_x_pct: 0, pan_y_pct: 0 })
    setTextoScale(1)
    setPosicao({ x: 50, y: 70 })
    setPosicaoLink({ x: 50, y: 82 })
    setPasso(2)
  }

  const onFileChange = (e) => {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    aplicarArquivo(f)
  }

  const abrirSeletorNativo = () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    const input = inputPrincipalRef.current
    if (!input) return
    autoPickerRef.current.startedAt = Date.now()
    autoPickerRef.current.opened = true
    try {
      const el = /** @type {HTMLInputElement & { showPicker?: () => void }} */ (input)
      if (typeof el.showPicker === 'function') {
        el.showPicker()
        return
      }
    } catch {
      /* noop */
    }
    input.click()
  }

  // Elimina o passo 1: ao entrar, abre o seletor nativo (iOS/Android/desktop).
  useEffect(() => {
    if (passo !== 1) return
    if (autoPickerRef.current.opened) return
    const t = window.setTimeout(() => abrirSeletorNativo(), 0)

    const onFocus = () => {
      if (passo !== 1) return
      if (file) return
      const dt = Date.now() - autoPickerRef.current.startedAt
      if (dt < 350) return
      router.push('/feed')
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('focus', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo])

  const voltarAoInicio = () => {
    if (previewBlob) URL.revokeObjectURL(previewBlob)
    setPreviewBlob(null)
    setFile(null)
    setLegenda('')
    setPosicao({ x: 50, y: 70 })
    setPosicaoLink({ x: 50, y: 82 })
    setFundo({ scale: 1, pan_x_pct: 0, pan_y_pct: 0 })
    setTextoScale(1)
    setLinkUrl('')
    setMarcacoes([])
    setPasso(1)
  }

  const publicar = async () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    if (!podeInteragirFeedSocial) {
      avisarBloqueioFeed()
      return
    }
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

      const fileToUpload = await compressImageFileForStoryUpload(file)
      const ext = fileToUpload.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop() || 'jpg'
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('stories').upload(path, fileToUpload, {
        contentType: fileToUpload.type || 'image/jpeg',
        upsert: false,
      })
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
          fundo_fit: 'contain',
          fundo_scale: fundo.scale,
          fundo_pan_x_pct: fundo.pan_x_pct,
          fundo_pan_y_pct: fundo.pan_y_pct,
          texto_scale: textoScale,
        },
        link: linkUrl.trim() || null,
        marcacoes,
        expira_em: expira,
        duracao_segundos: 60,
      })

      if (insErr) throw insErr

      router.push('/feed')
      void Promise.resolve().then(() => router.refresh())
    } catch (e) {
      console.error(e)
      alert('Não foi possível publicar o story.')
    } finally {
      setPublicando(false)
    }
  }

  return (
    <div className={passo === 1 ? 'min-h-[100dvh] bg-black' : 'flex min-h-[100dvh] flex-col bg-black'}>
      {/* Passo 1 eliminado: abrimos o seletor nativo ao montar. Mantemos só um fallback discreto. */}
      {passo === 1 ? (
        <div className="flex min-h-[100dvh] items-center justify-center bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
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
            onClick={() => abrirSeletorNativo()}
            className="rounded-lg bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
          >
            Abrindo galeria/câmera…
          </button>
        </div>
      ) : null}

      <input
        ref={inputTrocarFotoRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Trocar foto do story"
        onChange={onFileChange}
      />

      <div className={passo === 1 ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        {passo === 2 && previewBlob ? (
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
            textoScale={textoScale}
            onTextoScaleChange={setTextoScale}
            linkUrl={linkUrl}
            onLinkChange={setLinkUrl}
            marcacoes={marcacoes}
            onMarcacoesChange={setMarcacoes}
            onTrocarFoto={() => inputTrocarFotoRef.current?.click()}
            onPublicar={() => void publicar()}
            publicando={publicando}
          />
        ) : null}
      </div>
      <PopupAvisoBloqueioConta
        aberto={avisoFeedAberto}
        onFechar={fecharAvisoBloqueioFeed}
        titulo={tituloBloqueioFeed}
        mensagem={mensagemBloqueioFeed}
      />
    </div>
  )
}
