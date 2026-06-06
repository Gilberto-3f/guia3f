'use client'

import { Car, DollarSign, Hotel } from 'lucide-react'

interface Props {
  mediaComissao: number
  atendimentos: number
  ocupacaoHoteleira: number | null
  categoriaEmpresa: string
}

export default function CardsResumo({ mediaComissao, atendimentos, ocupacaoHoteleira, categoriaEmpresa }: Props) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="rounded-lg border bg-white p-4">
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <DollarSign className="h-4 w-4 text-[#0097b2]" aria-hidden />
          Média comissão
        </p>
        <p className="text-2xl font-bold text-[#001f3f]">{Number.isFinite(mediaComissao) ? mediaComissao : 0}%</p>
        <p className="text-xs text-gray-400">no setor</p>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Car className="h-4 w-4 text-[#0097b2]" aria-hidden />
          Atendimentos
        </p>
        <p className="text-2xl font-bold text-[#001f3f]">{(atendimentos ?? 0).toLocaleString()}</p>
        <p className="text-xs text-gray-400">no período</p>
      </div>

      {categoriaEmpresa === 'Hospedagem' ? (
        <div className="rounded-lg border bg-white p-4">
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Hotel className="h-4 w-4 text-[#0097b2]" aria-hidden />
            Ocupação hoteleira
          </p>
          <p className="text-2xl font-bold text-[#001f3f]">{(ocupacaoHoteleira ?? 0).toLocaleString()}%</p>
          <p className="text-xs text-gray-400">média no período</p>
        </div>
      ) : (
        <div className="hidden md:block" />
      )}
    </div>
  )
}
