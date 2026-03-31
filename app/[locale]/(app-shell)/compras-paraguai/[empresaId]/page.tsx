'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type EmpresaRow = { id: string; nome_fantasia: string; foto_url: string | null }

type ProdutoRow = {
  id: string
  nome: string
  marca: string | null
  categoria_drena: string | null
  foto_url: string | null
  preco_brl: number
  preco_usd: number
  estoque: number
}

export default function CatalogoEmpresaPage() {
  const params = useParams()
  const router = useRouter()
  const empresaId = typeof params.empresaId === 'string' ? params.empresaId : params.empresaId?.[0] ?? ''

  const [empresa, setEmpresa] = useState<EmpresaRow | null>(null)
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [termoBusca, setTermoBusca] = useState('')

  const carregarDados = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('id, nome_fantasia, foto_url')
        .eq('id', empresaId)
        .maybeSingle()

      setEmpresa(empresaData ?? null)

      let query = supabase
        .from('produtos')
        .select('id, nome, marca, categoria_drena, foto_url, preco_brl, preco_usd, estoque')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)

      const t = termoBusca.trim()
      if (t) {
        query = query.ilike('nome', `%${t}%`)
      }

      const { data: produtosData } = await query.order('nome', { ascending: true })
      setProdutos(
        (produtosData ?? []).map((p) => ({
          id: String(p.id),
          nome: String(p.nome ?? ''),
          marca: p.marca != null ? String(p.marca) : null,
          categoria_drena: p.categoria_drena != null ? String(p.categoria_drena) : null,
          foto_url: p.foto_url != null ? String(p.foto_url) : null,
          preco_brl: Number(p.preco_brl) || 0,
          preco_usd: Number(p.preco_usd) || 0,
          estoque: Number(p.estoque) || 0,
        }))
      )
    } catch (e) {
      console.error('Erro ao carregar catálogo:', e)
    } finally {
      setLoading(false)
    }
  }, [empresaId, termoBusca])

  useEffect(() => {
    void carregarDados()
  }, [carregarDados])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3 p-4">
          <button type="button" onClick={() => router.back()} className="-ml-1 p-1" aria-label="Voltar">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-gray-800">{empresa?.nome_fantasia || 'Catálogo'}</h1>
            <p className="text-xs text-gray-500">Produtos disponíveis</p>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <input
              type="search"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar produtos..."
              className="w-full rounded-lg border border-gray-200 p-2 pl-8 text-sm"
            />
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="py-8 text-center text-gray-400">Carregando...</div>
        ) : produtos.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-400">
              {termoBusca.trim() ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado ainda'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {produtos.map((produto) => (
              <div key={produto.id} className="rounded-xl bg-white p-3 shadow-sm">
                <div className="flex gap-3">
                  {produto.foto_url ? (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src={produto.foto_url}
                        alt={produto.nome}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <span className="text-xs text-gray-400">Sem foto</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-800">{produto.nome}</h3>
                    {produto.marca ? <p className="text-sm text-gray-500">{produto.marca}</p> : null}
                    {produto.categoria_drena ? <p className="text-xs text-gray-400">{produto.categoria_drena}</p> : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-[#0097b2]">R$ {produto.preco_brl.toFixed(2)}</span>
                      {produto.preco_usd > 0 ? (
                        <span className="text-xs text-gray-400">US$ {produto.preco_usd.toFixed(2)}</span>
                      ) : null}
                      {produto.estoque <= 0 ? (
                        <span className="text-xs text-amber-600">Esgotado</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
