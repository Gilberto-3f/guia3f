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
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#96CEB4] py-3 font-bold text-white transition-colors hover:bg-[#7FB89C]"
    >
      <ShoppingBag size={18} aria-hidden />
      VER PRODUTOS
    </button>
  )
}
