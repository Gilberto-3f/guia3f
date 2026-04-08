'use client'

import { X } from 'lucide-react'
import { Link } from '@/i18n/navigation'

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   titulo?: string
 *   verNoFeedHref?: string | null
 *   children: import('react').ReactNode
 * }} props
 */
export default function ModalConteudo({ aberto, onFechar, titulo, verNoFeedHref = null, children }) {
  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onFechar} />
      <div className="relative z-[1] flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          {titulo ? <h3 className="pr-8 text-sm font-semibold text-gray-900">{titulo}</h3> : <span />}
          <button
            type="button"
            onClick={onFechar}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3">
          <button type="button" onClick={onFechar} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800">
            Fechar
          </button>
          {verNoFeedHref ? (
            <Link
              href={verNoFeedHref}
              className="rounded-lg bg-[#0097b2] px-4 py-2 text-sm font-medium text-white"
              onClick={onFechar}
            >
              Ver no feed
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
