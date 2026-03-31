'use client'

interface Props {
  mediaComissao: number
  atendimentos: number
  ocupacaoHoteleira: number | null
  categoriaEmpresa: string
}

export default function CardsResumo({ mediaComissao, atendimentos, ocupacaoHoteleira, categoriaEmpresa }: Props) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-gray-500">💰 Média comissão</p>
        <p className="text-2xl font-bold text-[#001f3f]">{Number.isFinite(mediaComissao) ? mediaComissao : 0}%</p>
        <p className="text-xs text-gray-400">no setor</p>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-gray-500">🚗 Atendimentos</p>
        <p className="text-2xl font-bold text-[#001f3f]">{(atendimentos ?? 0).toLocaleString()}</p>
        <p className="text-xs text-gray-400">no período</p>
      </div>

      {categoriaEmpresa === 'Hospedagem' ? (
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">🏨 Ocupação hoteleira</p>
          <p className="text-2xl font-bold text-[#001f3f]">{(ocupacaoHoteleira ?? 0).toLocaleString()}%</p>
          <p className="text-xs text-gray-400">média no período</p>
        </div>
      ) : (
        <div className="hidden md:block" />
      )}
    </div>
  )
}

