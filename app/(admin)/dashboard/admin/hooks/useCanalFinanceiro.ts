'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type CanalFinanceiroItem = {
  id: string
  tipo: string
  titulo: string
  mensagem: string | null
  valor: number | null
  created_at: string
  comprovante_detalhes: Record<string, unknown>
}

export function useCanalFinanceiro(usuarioId: string | null, tipo: 'profissional' | 'empresa') {
  const [itens, setItens] = useState<CanalFinanceiroItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const carregar = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    setError(null)
    try {
      let profissionalId: string | null = null
      let empresaId: string | null = null

      if (tipo === 'profissional') {
        const { data } = await supabase.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
        profissionalId = data?.id ? String(data.id) : null
      } else {
        const { data } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
        empresaId = data?.id ? String(data.id) : null
      }

      if (!profissionalId && !empresaId) {
        setItens([])
        return
      }

      let query = supabase
        .from('canal_financeiro')
        .select('id, tipo, titulo, mensagem, valor, comprovante_detalhes, created_at')
        .order('created_at', { ascending: false })

      if (tipo === 'profissional' && profissionalId) {
        query = query.eq('profissional_id', profissionalId)
      } else if (tipo === 'empresa' && empresaId) {
        query = query.eq('empresa_id', empresaId)
      }

      const { data, error: qErr } = await query
      if (qErr) throw qErr

      setItens(
        (data ?? []).map((row) => {
          const r = row as {
            id: string
            tipo?: string | null
            titulo?: string | null
            mensagem?: string | null
            valor?: number | null
            comprovante_detalhes?: Record<string, unknown> | null
            created_at?: string | null
          }
          return {
            id: r.id,
            tipo: r.tipo ?? '',
            titulo: r.titulo ?? '',
            mensagem: r.mensagem ?? null,
            valor: r.valor ?? null,
            comprovante_detalhes: r.comprovante_detalhes ?? {},
            created_at: r.created_at ?? new Date().toISOString(),
          }
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar canal financeiro'))
    } finally {
      setLoading(false)
    }
  }, [tipo, usuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return { itens, loading, error, refetch: carregar }
}

