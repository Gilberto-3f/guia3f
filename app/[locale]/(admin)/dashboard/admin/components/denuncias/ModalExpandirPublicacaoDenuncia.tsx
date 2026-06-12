'use client'

import { X } from 'lucide-react'
import PostIsoladoDrawer from '@/components/perfil/subpaginas/PostIsoladoDrawer'

export default function ModalExpandirPublicacaoDenuncia({
  aberto,
  postId,
  onClose,
}: {
  aberto: boolean
  postId: string | null
  onClose: () => void
}) {
  if (!aberto || !postId) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-bold text-gray-900">Publicação denunciada</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-2 py-3">
          <PostIsoladoDrawer postId={postId} />
        </div>
      </div>
    </div>
  )
}
