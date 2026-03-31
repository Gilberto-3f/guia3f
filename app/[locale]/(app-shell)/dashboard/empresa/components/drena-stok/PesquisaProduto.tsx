'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ResultadoPesquisa {
  nome: string
  total_buscas: number
  posicao: number
}

function asRecord(v: unknown) {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export default function PesquisaProduto() {
  const [termo, setTermo] = useState('')
  const [resultado, setResultado] = useState<ResultadoPesquisa | null>(null)
  const [buscando, setBuscando] = useState(false)

  const handlePesquisar = async () => {
    const t = termo.trim()
    if (t.length < 3) return

    setBuscando(true)
    try {
      const { data: produto, error: pErr } = await supabase.from('produtos').select('id, nome').ilike('nome', `%${t}%`).limit(1).maybeSingle()
      if (pErr || !produto) {
        setResultado(null)
        return
      }

      const produtoId = String(produto.id)

      const { count: totalBuscas, error: bErr } = await supabase
        .from('buscas_produto')
        .select('*', { count: 'exact', head: true })
        .eq('produto_id', produtoId)
      if (bErr) {
        setResultado({ nome: String(produto.nome), total_buscas: 0, posicao: 0 })
        return
      }

      const { data: ranking, error: rErr } = await supabase
        .from('buscas_produto')
        .select('produto_id')
        .not('produto_id', 'is', null)
        .limit(5000)
      if (rErr) {
        setResultado({ nome: String(produto.nome), total_buscas: totalBuscas ?? 0, posicao: 0 })
        return
      }

      const contagem: Record<string, number> = {}
      for (const row of (ranking ?? []) as unknown[]) {
        const r = asRecord(row) ?? {}
        const pid = r.produto_id != null ? String(r.produto_id) : ''
        if (!pid) continue
        contagem[pid] = (contagem[pid] ?? 0) + 1
      }

      const posicao =
        Object.entries(contagem)
          .sort((a, b) => b[1] - a[1])
          .findIndex(([id]) => id === produtoId) + 1

      setResultado({
        nome: String(produto.nome),
        total_buscas: totalBuscas ?? 0,
        posicao: posicao > 0 ? posicao : 0,
      })
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">🔍 Pesquisar Produto</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Digite um produto..."
          className="flex-1 rounded-lg border p-2"
        />
        <button
          type="button"
          onClick={() => void handlePesquisar()}
          disabled={buscando || termo.trim().length < 3}
          className="rounded-lg bg-[#0097b2] px-4 py-2 text-white disabled:opacity-50"
        >
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {resultado ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
          <p className="font-medium text-[#001f3f]">{resultado.nome}</p>
          <p className="text-gray-600">📊 {resultado.total_buscas.toLocaleString()} buscas</p>
          {resultado.posicao > 0 ? <p className="text-gray-600">🏆 {resultado.posicao}º lugar no ranking geral</p> : null}
        </div>
      ) : null}
    </div>
  )
}

