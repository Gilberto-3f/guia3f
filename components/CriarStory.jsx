'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Image as ImageIcon, Video } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import EditorStory from '@/components/EditorStory'
import PreviewStory from '@/components/PreviewStory'

const MAX_VIDEO_SEC = 60

/**
 * @param {{ autorTipo: 'turista' | 'profissional' | 'empresa' | string }} props
 */
export default function CriarStory({ autorTipo }) {
  const router = useRouter()
  const [passo, setPasso] = useState(/** @type {1 | 2 | 3} */ (1))
  const [file, setFile] = useState(/** @type {File | null} */ (null))
  const [mediaKind, setMediaKind] = useState(/** @type {'image' | 'video'} */ ('image'))
  const [previewBlob, setPreviewBlob] = useState(/** @type {string | null} */ (null))
  const [legenda, setLegenda] = useState('')
  const [posicao, setPosicao] = useState({ x: 50, y: 70 })
  const [linkUrl, setLinkUrl] = useState('')
  const [publicando, setPublicando] = useState(false)
  const [duracaoSeg, setDuracaoSeg] = useState(60)

  /**
   * @param {File | null} f
   */
  const aplicarArquivo = (f) => {
    if (!f) return
    if (f.type.startsWith('image/')) {
      setMediaKind('image')
      setFile(f)
      setPreviewBlob(URL.createObjectURL(f))
      setPasso(2)
      return
    }
    if (f.type.startsWith('video/')) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      const obj = URL.createObjectURL(f)
      v.onloadedmetadata = () => {
        const d = v.duration
        if (!Number.isFinite(d) || d > MAX_VIDEO_SEC + 0.5) {
          URL.revokeObjectURL(obj)
          alert(`O vídeo deve ter no máximo ${MAX_VIDEO_SEC} segundos.`)
          return
        }
        setDuracaoSeg(Math.min(MAX_VIDEO_SEC, Math.ceil(d)))
        setMediaKind('video')
        setFile(f)
        setPreviewBlob(obj)
        setPasso(2)
      }
      v.onerror = () => {
        URL.revokeObjectURL(obj)
        alert('Não foi possível ler o vídeo.')
      }
      v.src = obj
      return
    }
    alert('Selecione uma imagem ou vídeo.')
  }

  const irPrevia = () => {
    if (!previewBlob) return
    setPasso(3)
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

      const ext = file.name.split('.').pop() || (mediaKind === 'video' ? 'mp4' : 'jpg')
      const path = `${session.user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('stories').upload(path, file)
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('stories').getPublicUrl(path)
      const url = pub.publicUrl

      const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const { error: insErr } = await supabase.from('stories').insert({
        autor_id: session.user.id,
        autor_tipo: autorTipo,
        tipo: mediaKind === 'video' ? 'video' : 'foto',
        conteudo_url: url,
        texto_sobreposto: { texto: legenda.trim() || null, posicao_x: posicao.x, posicao_y: posicao.y },
        link: linkUrl.trim() || null,
        expira_em: expira,
        duracao_segundos: mediaKind === 'video' ? duracaoSeg : 60,
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="border-b border-gray-100 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-800">Novo story</h1>
        <p className="text-xs text-gray-500">Passo {passo} de 3 · expira em 24h</p>
      </div>

      <div className="p-4">
        {passo === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Foto, vídeo da galeria (máx. {MAX_VIDEO_SEC}s) ou câmera/câmera de vídeo no celular.</p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#0097b2] bg-white py-8">
              <ImageIcon className="text-[#0097b2]" size={32} aria-hidden />
              <span className="font-medium text-[#0097b2]">Selecionar arquivo</span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => aplicarArquivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0097b2]/10 py-4">
              <Camera className="text-[#0097b2]" size={28} aria-hidden />
              <span className="font-medium text-gray-800">Fotografar</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => aplicarArquivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0097b2]/10 py-4">
              <Video className="text-[#0097b2]" size={28} aria-hidden />
              <span className="font-medium text-gray-800">Gravar vídeo</span>
              <input
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={(e) => aplicarArquivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        ) : null}

        {passo === 2 && previewBlob ? (
          <EditorStory
            mediaSrc={previewBlob}
            mediaKind={mediaKind}
            legenda={legenda}
            onLegendaChange={setLegenda}
            posicao={posicao}
            onPosicaoChange={setPosicao}
            linkUrl={linkUrl}
            onLinkChange={setLinkUrl}
            onPreview={irPrevia}
          />
        ) : null}

        {passo === 3 && previewBlob ? (
          <PreviewStory
            mediaSrc={previewBlob}
            mediaKind={mediaKind}
            legenda={legenda}
            posicao={posicao}
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
