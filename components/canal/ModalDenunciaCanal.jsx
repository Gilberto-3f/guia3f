'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { MOTIVOS_DENUNCIA_CANAL } from '@/lib/canalDenuncias'

/**
 * @param {{
 *   aberto: boolean
 *   titulo?: string
 *   onFechar: () => void
 *   onEnviar: (motivo: string, descricao: string) => Promise<{ ok: boolean; error?: string }>
 * }} props
 */
export default function ModalDenunciaCanal({ aberto, titulo = 'Denunciar', onFechar, onEnviar }) {
  const [motivo, setMotivo] = useState('spam')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(/** @type {string | null} */ (null))

  if (!aberto) return null

  const enviar = async () => {
    setEnviando(true)
    setErro(null)
    try {
      const res = await onEnviar(motivo, descricao)
      if (!res.ok) {
        setErro(res.error ?? 'Não foi possível enviar a denúncia.')
        return
      }
      setDescricao('')
      setMotivo('spam')
      onFechar()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="denuncia-canal-titulo"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="denuncia-canal-titulo" className="text-lg font-semibold text-gray-900">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium text-gray-700">Motivo</label>
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
        >
          {MOTIVOS_DENUNCIA_CANAL.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-sm font-medium text-gray-700">Detalhes (opcional)</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={4}
          placeholder="Descreva o que aconteceu…"
          className="mb-3 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
        />

        {erro ? <p className="mb-2 text-sm text-red-600">{erro}</p> : null}

        <button
          type="button"
          disabled={enviando}
          onClick={() => void enviar()}
          className="w-full rounded-lg bg-[#0097b2] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar denúncia'}
        </button>
      </div>
    </div>
  )
}
