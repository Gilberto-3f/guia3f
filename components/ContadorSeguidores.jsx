'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'
import PopupSeguidores from '@/components/PopupSeguidores'

/**
 * @param {{ empresaId: string, total: number }} props
 */
export default function ContadorSeguidores({ empresaId, total }) {
  const [popupAberto, setPopupAberto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setPopupAberto(true)}
        className="flex items-center gap-1 text-gray-500 transition-colors hover:text-[#0097b2]"
      >
        <Users size={16} aria-hidden />
        <span className="text-sm">{total}</span>
        <span className="text-xs">seguidores</span>
      </button>

      <PopupSeguidores
        isOpen={popupAberto}
        onClose={() => setPopupAberto(false)}
        empresaId={empresaId}
      />
    </>
  )
}
