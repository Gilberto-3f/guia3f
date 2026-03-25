'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   postUrl: string
 *   postId: string
 *   tituloResumo: string
 *   usuarioId: string | null
 *   onCompartilhouFeed?: () => void
 * }} props
 */
export default function ModalCompartilhar({ aberto, onFechar, postUrl, postId, tituloResumo, usuarioId, onCompartilhouFeed }) {
  const [copiado, setCopiado] = useState(false)

  const compartilharFeed = async () => {
    if (!usuarioId) return
    const { error } = await supabase.from('posts').insert({
      autor_id: usuarioId,
      tipo: 'postagem',
      texto: `Confira: ${tituloResumo}\n${postUrl}`,
    })
    if (error) {
      console.error(error)
      return
    }
    const { error: rpcErr } = await supabase.rpc('incrementar_compartilhamentos', { post_id: postId })
    if (rpcErr) console.error(rpcErr)
    onCompartilhouFeed?.()
    onFechar()
  }

  const whatsapp = () => {
    const u = `https://wa.me/?text=${encodeURIComponent(`${tituloResumo} ${postUrl}`)}`
    window.open(u, '_blank')
    onFechar()
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(postUrl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      alert('Não foi possível copiar')
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Compartilhar</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            disabled={!usuarioId}
            onClick={() => void compartilharFeed()}
            className="w-full rounded-lg bg-[#0097b2] py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Publicar no feed
          </button>
          <button type="button" onClick={whatsapp} className="w-full rounded-lg border border-gray-200 py-3 text-sm font-medium">
            WhatsApp
          </button>
          <button type="button" onClick={() => void copiar()} className="w-full rounded-lg border border-gray-200 py-3 text-sm font-medium">
            {copiado ? 'Copiado!' : 'Copiar link'}
          </button>
        </div>
      </div>
    </div>
  )
}
