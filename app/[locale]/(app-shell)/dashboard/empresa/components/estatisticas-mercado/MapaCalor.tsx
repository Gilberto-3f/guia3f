'use client'

import { Map } from 'lucide-react'

interface Props {
  semTitulo?: boolean
  embed?: boolean
}

export default function MapaCalor({ semTitulo = false, embed = false }: Props) {
  const wrap = embed ? '' : 'rounded-lg border bg-white p-4'

  return (
    <div className={wrap}>
      {!semTitulo ? (
        <h3 className="mb-4 flex items-center gap-2 font-bold text-[#001f3f]">
          <Map className="h-5 w-5 text-[#0097b2]" aria-hidden />
          Mapa de calor — mobilidade
        </h3>
      ) : null}
      <div className="flex h-64 items-center justify-center rounded-lg bg-white">
        <div className="text-center text-gray-500">
          <Map className="mx-auto mb-2 h-8 w-8 text-gray-400" aria-hidden />
          <p className="text-sm font-medium">Mapa de calor em desenvolvimento</p>
          <p className="mt-2 text-xs">Áreas com maior concentração de solicitações de mobilidade.</p>
        </div>
      </div>
    </div>
  )
}
