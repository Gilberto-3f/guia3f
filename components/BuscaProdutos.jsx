'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * @typedef {{
 *   id: string
 *   nome: string
 *   marca: string | null
 *   categoria_drena: string | null
 *   foto_url: string | null
 *   preco_brl: number
 *   preco_pyg: number
 *   preco_ars: number
 *   preco_usd: number
 *   preco_eur: number
 *   empresa_id: string
 *   empresa_nome: string
 * }} ProdutoBusca
 */

/**
 * @param {{ onSelectProduto?: (p: ProdutoBusca) => void }} props
 */
export default function BuscaProdutos({ onSelectProduto }) {
  const [termoBusca, setTermoBusca] = useState('')
  const [resultados, setResultados] = useState(/** @type {ProdutoBusca[]} */ ([]))
  const [loading, setLoading] = useState(false)
  const [recentes, setRecentes] = useState(/** @type {string[]} */ ([]))

  useEffect(() => {
    try {
      const saved = localStorage.getItem('buscas_recentes')
      if (saved) setRecentes(JSON.parse(saved))
    } catch {
      /* ignore */
    }
  }, [])

  const salvarBuscaRecente = useCallback((termo) => {
    setRecentes((prev) => {
      const novos = [termo, ...prev.filter((r) => r !== termo)].slice(0, 5)
      try {
        localStorage.setItem('buscas_recentes', JSON.stringify(novos))
      } catch {
        /* ignore */
      }
      return novos
    })
  }, [])

  const buscarProdutos = useCallback(
    async (termoOpt) => {
      const raw = typeof termoOpt === 'string' ? termoOpt : termoBusca
      const termo = raw.trim()
      if (!termo) return

      setLoading(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session) {
          await supabase.from('buscas_produto').insert({ termo_busca: termo })
        }

        salvarBuscaRecente(termo)

        const esc = termo.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
        const { data, error } = await supabase
          .from('produtos')
          .select(
            `
          id,
          nome,
          marca,
          categoria_drena,
          foto_url,
          preco_brl,
          preco_pyg,
          preco_ars,
          preco_usd,
          preco_eur,
          empresa_id,
          empresas!inner (nome_fantasia)
        `
          )
          .or(`nome.ilike.%${esc}%,marca.ilike.%${esc}%,categoria_drena.ilike.%${esc}%`)
          .eq('ativo', true)
          .limit(20)

        if (error) throw error

        const produtosFormatados =
          data?.map((p) => {
            const row = /** @type {Record<string, unknown>} */ (p)
            const emp = row.empresas
            const nomeFantasia =
              emp && typeof emp === 'object' && 'nome_fantasia' in emp
                ? String(/** @type {{ nome_fantasia?: string }} */ (emp).nome_fantasia ?? '')
                : ''
            return {
              id: String(row.id),
              nome: String(row.nome ?? ''),
              marca: row.marca != null ? String(row.marca) : null,
              categoria_drena: row.categoria_drena != null ? String(row.categoria_drena) : null,
              foto_url: row.foto_url != null ? String(row.foto_url) : null,
              preco_brl: Number(row.preco_brl) || 0,
              preco_pyg: Number(row.preco_pyg) || 0,
              preco_ars: Number(row.preco_ars) || 0,
              preco_usd: Number(row.preco_usd) || 0,
              preco_eur: Number(row.preco_eur) || 0,
              empresa_id: String(row.empresa_id ?? ''),
              empresa_nome: nomeFantasia,
            }
          }) ?? []

        setResultados(produtosFormatados)
      } catch (e) {
        console.error('Erro ao buscar produtos:', e)
      } finally {
        setLoading(false)
      }
    },
    [termoBusca, salvarBuscaRecente]
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    void buscarProdutos(termoBusca)
  }

  const handleBuscaRecente = (termo) => {
    setTermoBusca(termo)
    void buscarProdutos(termo)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Buscar produtos, marcas ou categorias..."
            className="w-full rounded-lg border border-gray-200 p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
          />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
          {termoBusca ? (
            <button
              type="button"
              onClick={() => setTermoBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="Limpar"
            >
              <X size={16} className="text-gray-400" />
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#0097b2] px-4 font-medium text-white disabled:opacity-50"
        >
          {loading ? '...' : 'Buscar'}
        </button>
      </form>

      {recentes.length > 0 && resultados.length === 0 && !termoBusca ? (
        <div>
          <p className="mb-2 text-xs text-gray-400">Buscas recentes</p>
          <div className="flex flex-wrap gap-2">
            {recentes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleBuscaRecente(t)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 hover:bg-gray-200"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {resultados.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{resultados.length} produtos encontrados</p>
          {resultados.map((produto) => (
            <button
              key={produto.id}
              type="button"
              onClick={() => onSelectProduto?.(produto)}
              className="w-full rounded-xl bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex gap-3">
                {produto.foto_url ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={produto.foto_url}
                      alt={produto.nome}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <span className="text-xs text-gray-400">Sem foto</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-800">{produto.nome}</h3>
                  {produto.marca ? <p className="text-sm text-gray-500">{produto.marca}</p> : null}
                  <p className="text-sm text-gray-400">{produto.empresa_nome}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="text-sm font-semibold text-[#0097b2]">R$ {produto.preco_brl.toFixed(2)}</span>
                    {produto.preco_usd > 0 ? (
                      <span className="text-xs text-gray-400">US$ {produto.preco_usd.toFixed(2)}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {!loading && resultados.length === 0 && termoBusca.trim() ? (
        <div className="py-8 text-center">
          <p className="text-gray-400">Nenhum produto encontrado para &quot;{termoBusca}&quot;</p>
        </div>
      ) : null}
    </div>
  )
}
