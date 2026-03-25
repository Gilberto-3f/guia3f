'use client'

import { useState } from 'react'
import { X, Building2, Package } from 'lucide-react'

/**
 * @param {{ isOpen: boolean, onClose: () => void }} props
 */
export default function PopupFavoritos({ isOpen, onClose }) {
  const [abaAtiva, setAbaAtiva] = useState('empresas')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="max-h-[80vh] w-full overflow-hidden rounded-t-2xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 className="text-lg font-semibold">Meus Favoritos</h2>
          <button type="button" onClick={onClose} className="p-1" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          <button
            type="button"
            onClick={() => setAbaAtiva('empresas')}
            className={`flex-1 py-3 text-center text-sm font-medium ${
              abaAtiva === 'empresas'
                ? 'border-b-2 border-[#0097b2] text-[#0097b2]'
                : 'text-gray-500'
            }`}
          >
            <Building2 size={16} className="mr-1 inline" aria-hidden />
            Empresas
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('produtos')}
            className={`flex-1 py-3 text-center text-sm font-medium ${
              abaAtiva === 'produtos'
                ? 'border-b-2 border-[#0097b2] text-[#0097b2]'
                : 'text-gray-500'
            }`}
          >
            <Package size={16} className="mr-1 inline" aria-hidden />
            Itens Salvos
          </button>
        </div>

        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(80vh - 120px)' }}>
          {abaAtiva === 'empresas' ? (
            <div className="py-8 text-center text-gray-400">Nenhuma empresa favoritada ainda</div>
          ) : (
            <div className="py-8 text-center text-gray-400">Nenhum produto salvo ainda</div>
          )}
        </div>
      </div>
    </div>
  )
}
