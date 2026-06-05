'use client'

interface Props {
  total: number
}

export default function CardVendas({ total }: Props) {
  if (total === 0) {
    return <div className="py-2 text-center text-sm text-gray-500">Nenhuma venda registrada no período</div>
  }

  return (
    <div className="space-y-2">
      <h4 className="font-bold text-[#001f3f]">VENDAS DIRETAS</h4>
      <p className="text-sm text-gray-600">
        Total de <strong className="text-[#001f3f]">{total.toLocaleString('pt-BR')}</strong> vendas diretas
        registradas no período selecionado.
      </p>
    </div>
  )
}
