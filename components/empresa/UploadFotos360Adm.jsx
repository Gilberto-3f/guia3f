'use client'

import { useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { medirProporcaoImagem, parseTourConfig, sincronizarTourComFotos, validarProporcao360 } from '@/lib/pannellumTour'
import { deleteFoto360Empresa, patchEmpresaTour360 } from '@/lib/tour360Api'

/**
 * Upload de fotos 360° (equiretangulares) para `empresas.fotos_360_url`.
 * Destinado a utilizadores com role `admin` na UI.
 *
 * @param {{
 *   empresaId: string
 *   fotos360Atuais: string[]
 *   tourConfigAtual?: import('@/lib/tour360Types').TourConfig | unknown
 *   onAtualizado?: () => void
 * }} props
 */
export default function UploadFotos360Adm({ empresaId, fotos360Atuais, tourConfigAtual, onAtualizado }) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [enviando, setEnviando] = useState(false)
  const [removendo, setRemovendo] = useState(/** @type {string | null} */ (null))
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
      const { ratio } = await medirProporcaoImagem(file)
      if (!validarProporcao360(ratio)) {
        setMsg(
          'A imagem não está no formato 360° correto (proporção 2:1). A visualização pode ficar distorcida.'
        )
        setEnviando(false)
        return
      }

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

      const proximas = [...new Set([...atuais, url])]
      const tour = sincronizarTourComFotos(proximas, parseTourConfig(tourConfigAtual))

      const res = await patchEmpresaTour360({
        empresaId,
        fotos_360_url: proximas,
        tour_config: tour,
      })
      if (!res.ok) throw new Error(res.error ?? 'Erro ao atualizar empresa.')

      setMsg('Imagem 360° adicionada.')
      onAtualizado?.()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao enviar.')
    } finally {
      setEnviando(false)
    }
  }

  const handleRemover = async (url) => {
    if (
      !window.confirm('Remover esta imagem 360°? As conexões de tour associadas serão perdidas.')
    ) {
      return
    }
    setRemovendo(url)
    setMsg(null)
    try {
      const res = await deleteFoto360Empresa({ empresaId, url })
      if (!res.ok) throw new Error(res.error ?? 'Erro ao remover.')
      setMsg('Imagem removida.')
      onAtualizado?.()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao remover.')
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <div className="border-b border-[#E0E0E0] bg-gray-50 px-3 py-3">
      <p className="mb-2 text-xs text-gray-600">
        Adicionar vista 360° (imagem equiretangular 2:1). Arraste no visualizador para girar após publicar.
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
            {atuais.map((u) => (
              <div key={u} className="relative aspect-square overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                <button
                  type="button"
                  disabled={removendo === u}
                  onClick={() => void handleRemover(u)}
                  className="absolute top-1 right-1 rounded-full bg-red-500 p-1 text-white hover:bg-red-700 disabled:opacity-50"
                  aria-label="Remover imagem 360"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {msg ? <p className="mt-2 text-xs text-gray-700">{msg}</p> : null}
    </div>
  )
}
