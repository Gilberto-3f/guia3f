'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * Upload de fotos 360° (equiretangulares) para `empresas.fotos_360_url`.
 * Destinado a utilizadores com role `admin` na UI.
 *
 * @param {{
 *   empresaId: string
 *   fotos360Atuais: string[]
 *   onAtualizado?: () => void
 * }} props
 */
export default function UploadFotos360Adm({ empresaId, fotos360Atuais, onAtualizado }) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState(/** @type {string | null} */ (null))

  const atuais = Array.isArray(fotos360Atuais) ? fotos360Atuais.filter((u) => typeof u === 'string' && u.trim()) : []

  const handleChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !empresaId) return
    if (!file.type.startsWith('image/')) {
      setMsg('Escolha um ficheiro de imagem (JPG, PNG ou WebP).')
      return
    }
    setEnviando(true)
    setMsg(null)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `360/${empresaId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
      const { error: upErr } = await supabase.storage.from('empresas').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('empresas').getPublicUrl(path)
      const url = pub?.publicUrl
      if (!url) throw new Error('URL pública indisponível.')

      // Evita sobrescrever a lista quando o utilizador envia múltiplas fotos rapidamente.
      const { data: row, error: selErr } = await supabase
        .from('empresas')
        .select('fotos_360_url')
        .eq('id', empresaId)
        .maybeSingle()
      if (selErr) throw new Error(selErr.message)
      const raw = row?.fotos_360_url
      const base = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string' && x.trim()) : atuais
      const proximas = [...new Set([...base, url])]

      const { error: dbErr } = await supabase.from('empresas').update({ fotos_360_url: proximas }).eq('id', empresaId)
      if (dbErr) throw new Error(dbErr.message)
      setMsg('Imagem 360° adicionada.')
      onAtualizado?.()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao enviar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="border-b border-[#E0E0E0] bg-gray-50 px-3 py-3">
      <p className="mb-2 text-xs text-gray-600">
        Adicionar vista 360° (imagem equiretangular). Arraste no visualizador para girar após publicar.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Escolher imagem 360 graus"
        onChange={(ev) => void handleChange(ev)}
      />
      <button
        type="button"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#0097b2] bg-white py-2.5 text-sm font-semibold text-[#0097b2] shadow-sm transition hover:bg-[#0097b2]/10 disabled:opacity-50 sm:w-auto sm:px-5"
      >
        <Upload size={18} className="shrink-0" aria-hidden />
        {enviando ? 'A enviar…' : 'Carregar foto 360°'}
      </button>
      <div className="mt-2">
        <p className="text-[11px] text-gray-600">Atuais no banco: {atuais.length}</p>
        {atuais.length ? (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {atuais.slice(0, 8).map((u) => (
              <div key={u} className="relative aspect-square overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- host remoto pode não estar em remotePatterns */}
                <img
                  src={u}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {msg ? <p className="mt-2 text-xs text-gray-700">{msg}</p> : null}
    </div>
  )
}
