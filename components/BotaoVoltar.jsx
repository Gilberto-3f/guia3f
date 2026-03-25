'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function BotaoVoltar() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="-ml-2 rounded-full p-2 transition-colors hover:bg-gray-100"
      aria-label="Voltar"
    >
      <ArrowLeft size={24} className="text-gray-600" />
    </button>
  )
}
