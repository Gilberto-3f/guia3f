'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

interface Props {
  placeholder?: string
  onBuscar: (termo: string) => void
  onLimpar?: () => void
  buscando?: boolean
}

export default function BuscadorGuiaSegmento({
  placeholder = 'Buscar no segmento…',
  onBuscar,
  onLimpar,
  buscando = false,
}: Props) {
  const [termo, setTermo] = useState('')

  const executar = () => {
    onBuscar(termo.trim())
  }

  const limpar = () => {
    setTermo('')
    onLimpar?.()
  }

  return (
    <div className="flex w-full gap-2">
      <input
        type="search"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            executar()
          }
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border-2 border-[#007a91] bg-[#0097b2] px-3 py-2 text-sm font-medium text-black placeholder:text-black/60 focus:outline-none focus:ring-2 focus:ring-white/40"
        aria-label="Buscar empresas por palavra-chave"
      />
      <button
        type="button"
        onClick={executar}
        disabled={buscando}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-white/30 bg-[#0097b2] px-3 py-2 text-black transition hover:bg-[#007a91] disabled:opacity-60"
        aria-label="Pesquisar"
      >
        <Search className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      </button>
      {termo ? (
        <button
          type="button"
          onClick={limpar}
          className="shrink-0 rounded-lg border border-white/40 px-2 py-1 text-xs text-white hover:bg-white/10"
        >
          Limpar
        </button>
      ) : null}
    </div>
  )
}
