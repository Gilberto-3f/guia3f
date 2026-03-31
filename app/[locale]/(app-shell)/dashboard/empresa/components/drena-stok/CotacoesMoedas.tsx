'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type CotacaoRow = { moeda: string; valor_brl: number; atualizado_em: string }

export default function CotacoesMoedas() {
  const [cotacoes, setCotacoes] = useState<CotacaoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    const load = async () => {
      setLoading(true)
      const { data } = await supabase.from('cotacoes').select('moeda, valor_brl, atualizado_em').order('atualizado_em', { ascending: false }).limit(50)
      if (!ativo) return

      const map = new Map<string, CotacaoRow>()
      for (const row of (data ?? []) as unknown[]) {
        const r = row as Record<string, unknown>
        const moeda = r.moeda != null ? String(r.moeda) : ''
        if (!moeda) continue
        if (map.has(moeda)) continue
        map.set(moeda, {
          moeda,
          valor_brl: r.valor_brl != null ? Number(r.valor_brl) : 0,
          atualizado_em: r.atualizado_em != null ? String(r.atualizado_em) : '',
        })
      }
      setCotacoes(Array.from(map.values()))
      setLoading(false)
    }
    void load()
    return () => {
      ativo = false
    }
  }, [])

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">💱 Cotações (para turistas)</h3>
      {loading ? (
        <div className="py-6 text-center text-sm text-gray-500">Carregando…</div>
      ) : cotacoes.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">Nenhuma cotação disponível</div>
      ) : (
        <div className="space-y-2">
          {cotacoes.map((c) => (
            <div key={c.moeda} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
              <span className="font-medium text-gray-700">{c.moeda}</span>
              <span className="text-[#001f3f]">R$ {c.valor_brl.toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

