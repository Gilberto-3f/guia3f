'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BuscaProdutos from '@/components/BuscaProdutos'
import CotacoesMoedas from '@/components/CotacoesMoedas'
import ComparadorPrecos from '@/components/ComparadorPrecos'
import Rankings from '@/components/Rankings'
import Tendencias from '@/components/Tendencias'

type ProdutoBusca = {
  id: string
  nome: string
  marca: string | null
  categoria_drena: string | null
  foto_url: string | null
  preco_brl: number
  preco_pyg: number
  preco_ars: number
  preco_usd: number
  preco_eur: number
  empresa_id: string
  empresa_nome: string
}

export default function ComprasParaguaiPage() {
  const router = useRouter()
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoBusca | null>(null)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-800">Compras Paraguai</h1>
          <p className="text-sm text-gray-500">Compare preços e economize</p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <CotacoesMoedas />

        <BuscaProdutos onSelectProduto={setProdutoSelecionado} />

        {produtoSelecionado ? (
          <ComparadorPrecos
            produto={{
              id: produtoSelecionado.id,
              nome: produtoSelecionado.nome,
              preco_brl: produtoSelecionado.preco_brl,
              preco_usd: produtoSelecionado.preco_usd,
              preco_ars: produtoSelecionado.preco_ars,
              preco_pyg: produtoSelecionado.preco_pyg,
              preco_eur: produtoSelecionado.preco_eur,
              empresa_nome: produtoSelecionado.empresa_nome,
            }}
            onComprar={() => {
              router.push(`/empresa/${produtoSelecionado.empresa_id}`)
            }}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4">
          <Rankings />
          <Tendencias />
        </div>
      </div>
    </div>
  )
}
