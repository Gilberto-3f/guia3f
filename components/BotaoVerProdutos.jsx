'use client'

import { useRouter } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'

/**
 * @param {{ empresaId: string }} props
 */
export default function BotaoVerProdutos({ empresaId }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.push(`/compras-paraguai/${empresaId}`)}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D443] py-3 text-sm font-bold text-white transition-colors hover:opacity-95 sm:text-base"
    >
      <ShoppingBag size={18} aria-hidden />
      CATÁLOGO
    </button>
  )
}
