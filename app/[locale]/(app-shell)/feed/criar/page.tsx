'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Image as ImageIcon, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function CriarPublicacaoPage() {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFoto(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setFotoPreview(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!texto.trim() && !foto) return

    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        alert('Faça login para continuar')
        return
      }

      let fotoUrl = /** @type {string | null} */ (null)
      if (foto) {
        const fileExt = foto.name.split('.').pop() || 'jpg'
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${session.user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('posts').upload(filePath, foto, {
          upsert: false,
        })

        if (uploadError) throw uploadError

        const { data: pub } = supabase.storage.from('posts').getPublicUrl(filePath)
        fotoUrl = pub.publicUrl
      }

      const tipo = foto && texto.trim() ? 'misto' : foto ? 'foto' : 'texto'

      const { error } = await supabase.from('posts').insert({
        autor_id: session.user.id,
        texto: texto.trim() || null,
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between p-4">
          <button type="button" onClick={() => router.back()} className="-ml-1 p-1" aria-label="Voltar">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold">Nova publicação</h1>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={(!texto.trim() && !foto) || loading}
            className="rounded-lg bg-[#0097b2] px-4 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </div>

      <div className="p-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="O que você está pensando?"
          className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
          rows={6}
        />

        {fotoPreview ? (
          <div className="relative mt-3">
            <div className="relative max-h-64 w-full overflow-hidden rounded-lg">
              <Image src={fotoPreview} alt="" width={800} height={400} className="max-h-64 w-full object-cover" unoptimized />
            </div>
            <button
              type="button"
              onClick={() => {
                setFoto(null)
                setFotoPreview(null)
              }}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1"
              aria-label="Remover foto"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        ) : null}

        <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 p-2 hover:bg-gray-50">
          <ImageIcon size={20} className="text-gray-500" aria-hidden />
          <span className="text-sm text-gray-600">Adicionar foto</span>
          <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
        </label>
      </div>
    </div>
  )
}
