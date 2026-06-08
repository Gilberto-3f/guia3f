'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

interface Props {
  placeholder?: string
  onBuscar: (termo: string) => void
  buscando?: boolean
}

export default function BuscadorGuiaSegmento({
  placeholder = 'Buscar no segmento…',
  onBuscar,
  buscando = false,
}: Props) {
  const [termo, setTermo] = useState('')

  const executar = () => {
    onBuscar(termo.trim())
  }

  return (
    <div className="flex w-full gap-2">
      <input
        type="text"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            executar()
          }
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0097b2]/30"
        aria-label="Buscar empresas por palavra-chave"
      />
      <button
        type="button"
        onClick={executar}
        disabled={buscando}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 transition hover:bg-gray-50 disabled:opacity-60"
        aria-label="Pesquisar"
      >
        <Search className="h-5 w-5 text-[#0097b2]" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  )
}
