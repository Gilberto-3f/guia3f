'use client'

import AvisoDocsProfissionalBloqueado from '@/components/AvisoDocsProfissionalBloqueado'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'

export default function MobilidadePage() {
  const { perfilEhProfissional, recursosProfissionaisLiberados, loading } = useProfissionalGate()

  if (perfilEhProfissional && (loading || !recursosProfissionaisLiberados)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <AvisoDocsProfissionalBloqueado />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900">Mobilidade</h1>
      <p className="mt-2 text-gray-600">Destino e corrida em breve.</p>
    </div>
  )
}
