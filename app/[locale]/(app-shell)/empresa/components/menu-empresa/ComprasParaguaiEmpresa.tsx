'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'

type ProdutoForm = {
  nome: string
  descricao: string
  categoria_drena: string
  marca: string
  preco_brl: string
  foto_url: string
}

function asRecord(v: unknown) {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export default function ComprasParaguaiEmpresa() {
  const { dados: empresa } = useDashboardEmpresa()
  const empresaId = empresa?.id ?? null

  const [produtos, setProdutos] = useState<
    { id: string; nome: string; descricao: string | null; categoria_drena: string; marca: string | null; preco_brl: number | null; foto_url: string | null }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [formAberto, setFormAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [novo, setNovo] = useState<ProdutoForm>({
    nome: '',
    descricao: '',
    categoria_drena: 'smartphones',
    marca: '',
    preco_brl: '',
    foto_url: '',
  })

  const carregar = async () => {
    if (!empresaId) return
    setLoading(true)
    setErro(null)
    const { data, error } = await supabase
      .from('produtos')
      .select('id, nome, descricao, categoria_drena, marca, preco_brl, foto_url, created_at')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
    if (error) {
      setErro('Não foi possível carregar seus produtos.')
      setProdutos([])
      setLoading(false)
      return
    }

    const fmt =
      (data ?? []).map((row) => {
        const r = asRecord(row) ?? {}
        return {
          id: String(r.id ?? ''),
          nome: String(r.nome ?? ''),
          descricao: r.descricao != null ? String(r.descricao) : null,
          categoria_drena: String(r.categoria_drena ?? ''),
          marca: r.marca != null ? String(r.marca) : null,
          preco_brl: r.preco_brl != null ? Number(r.preco_brl) : null,
          foto_url: r.foto_url != null ? String(r.foto_url) : null,
        }
      }) ?? []

    setProdutos(fmt)
    setLoading(false)
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  const podeSalvar = useMemo(() => novo.nome.trim().length > 0, [novo.nome])

  const cadastrar = async () => {
    if (!empresaId || !podeSalvar) return
    setSalvando(true)
    setErro(null)
    try {
      const preco = novo.preco_brl.trim() ? Number(novo.preco_brl) : null
      const { error } = await supabase.from('produtos').insert({
        empresa_id: empresaId,
        nome: novo.nome.trim(),
        descricao: novo.descricao.trim() ? novo.descricao.trim() : null,
        categoria_drena: novo.categoria_drena,
        marca: novo.marca.trim() ? novo.marca.trim() : null,
        preco_brl: preco != null && Number.isFinite(preco) ? preco : null,
        foto_url: novo.foto_url.trim() ? novo.foto_url.trim() : null,
      })
      if (error) throw error
      setFormAberto(false)
      setNovo({ nome: '', descricao: '', categoria_drena: 'smartphones', marca: '', preco_brl: '', foto_url: '' })
      await carregar()
    } catch {
      setErro('Não foi possível cadastrar o produto.')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-500">Carregando...</div>

  return (
    <div className="space-y-6">
      {erro ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div> : null}

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-bold text-[#001f3f]">🛍️ Meus Produtos</h3>
          <button
            type="button"
            onClick={() => setFormAberto((v) => !v)}
            className="rounded-lg bg-[#0097b2] px-3 py-1 text-sm text-white"
          >
            {formAberto ? 'Cancelar' : '+ Cadastrar Produto'}
          </button>
        </div>

        {formAberto ? (
          <div className="mb-6 space-y-3 rounded-lg bg-gray-50 p-4">
            <h4 className="font-medium text-gray-800">Novo Produto</h4>
            <input
              type="text"
              placeholder="Nome do produto *"
              value={novo.nome}
              onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))}
              className="w-full rounded-lg border p-2"
            />
            <textarea
              placeholder="Descrição"
              value={novo.descricao}
              onChange={(e) => setNovo((p) => ({ ...p, descricao: e.target.value }))}
              className="w-full rounded-lg border p-2"
              rows={2}
            />
            <select
              value={novo.categoria_drena}
              onChange={(e) => setNovo((p) => ({ ...p, categoria_drena: e.target.value }))}
              className="w-full rounded-lg border p-2"
            >
              <option value="smartphones">Smartphones</option>
              <option value="eletronicos">Eletrônicos</option>
              <option value="perfumaria">Perfumaria</option>
              <option value="vestuario">Vestuário</option>
              <option value="bebidas">Bebidas</option>
              <option value="brinquedos">Brinquedos</option>
            </select>
            <input
              type="text"
              placeholder="Marca"
              value={novo.marca}
              onChange={(e) => setNovo((p) => ({ ...p, marca: e.target.value }))}
              className="w-full rounded-lg border p-2"
            />
            <input
              type="number"
              placeholder="Preço (R$)"
              value={novo.preco_brl}
              onChange={(e) => setNovo((p) => ({ ...p, preco_brl: e.target.value }))}
              className="w-full rounded-lg border p-2"
            />
            <input
              type="url"
              placeholder="URL da foto"
              value={novo.foto_url}
              onChange={(e) => setNovo((p) => ({ ...p, foto_url: e.target.value }))}
              className="w-full rounded-lg border p-2"
            />
            <button
              type="button"
              onClick={() => void cadastrar()}
              disabled={!podeSalvar || salvando}
              className="w-full rounded-lg bg-green-600 py-2 text-white disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        ) : null}

        {produtos.length === 0 ? (
          <p className="py-8 text-center text-gray-500">Nenhum produto cadastrado</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {produtos.map((produto) => (
              <div key={produto.id} className="rounded-lg border p-3">
                {produto.foto_url ? (
                  <div className="relative mb-2 h-32 w-full overflow-hidden rounded">
                    <Image src={produto.foto_url} alt={produto.nome} fill className="object-cover" sizes="600px" />
                  </div>
                ) : null}
                <p className="font-medium text-gray-900">{produto.nome}</p>
                <p className="text-sm text-gray-500">{produto.marca || 'Sem marca'}</p>
                <p className="mt-1 text-sm font-bold text-[#001f3f]">
                  {produto.preco_brl != null ? `R$ ${produto.preco_brl.toFixed(2)}` : 'Preço sob consulta'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

