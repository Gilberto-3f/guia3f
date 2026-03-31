'use client'

interface Props {
  totalProdutos: number
  totalBuscas: number
  desempenho: { nome: string; buscas: number; posicao: number }[]
  onVerProdutos: () => void
  onCadastrarNovo: () => void
}

export default function SeusProdutos({ totalProdutos, totalBuscas, desempenho, onVerProdutos, onCadastrarNovo }: Props) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">🏪 Seus Produtos</h3>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Total de produtos</p>
          <p className="text-2xl font-bold text-[#001f3f]">{totalProdutos}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total de buscas</p>
          <p className="text-2xl font-bold text-[#001f3f]">{totalBuscas.toLocaleString()}</p>
        </div>
      </div>

      {desempenho.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-700">📊 Desempenho (mais procurados):</p>
          <div className="space-y-1">
            {desempenho.slice(0, 3).map((item) => (
              <div key={item.nome} className="text-sm text-gray-700">
                • {item.nome}: {item.buscas} buscas
                {item.posicao > 0 ? <span className="ml-1 text-gray-500">({item.posicao}º lugar geral)</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onVerProdutos}
          className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
        >
          VER MEUS PRODUTOS
        </button>
        <button
          type="button"
          onClick={onCadastrarNovo}
          className="flex-1 rounded-lg bg-[#0097b2] px-3 py-2 text-sm text-white hover:bg-[#007a91]"
        >
          ➕ CADASTRAR NOVO
        </button>
      </div>
    </div>
  )
}

