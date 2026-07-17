'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export type CampoLegalPopup = 'politicas_privacidade' | 'termos_uso'

const TITULOS: Record<CampoLegalPopup, string> = {
  politicas_privacidade: 'Políticas de Privacidade',
  termos_uso: 'Termos de Uso',
}

export function PopupTextoLegal({
  campo,
  onClose,
}: {
  campo: CampoLegalPopup
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')

  useEffect(() => {
    let ativo = true
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/legal/conteudo?campo=${encodeURIComponent(campo)}`)
        const json = (await res.json().catch(() => ({}))) as { texto?: string }
        if (!ativo) return
        const t = String(json.texto ?? '').trim()
        setTexto(t || 'Conteúdo em atualização.')
      } catch {
        if (ativo) setTexto('Conteúdo em atualização.')
      } finally {
        if (ativo) setLoading(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [campo])

  return (
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-legal-titulo"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <h2 id="popup-legal-titulo" className="text-base font-bold text-[#0097b2]">
            {TITULOS[campo]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-center text-sm text-gray-400">Carregando…</p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#001f3f]">{texto}</p>
          )}
        </div>
      </div>
    </div>
  )
}
