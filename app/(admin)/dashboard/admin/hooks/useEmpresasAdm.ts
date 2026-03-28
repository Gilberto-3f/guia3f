'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type EmpresaAdm = {
  id: string
  nome: string
  username: string
  categoria: string
  cidade: string
  plano: string
  nota: number
  status: string
}

export function useEmpresasAdm(busca: string) {
  const [empresas, setEmpresas] = useState<EmpresaAdm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchEmpresas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from('empresas').select('id, nome_fantasia, nome_usuario, categoria, cidade, plano, nota_media, status').order('nome_fantasia', {
        ascending: true,
      })
      if (busca.trim().length >= 2) {
        const term = busca.trim()
        query = query.or(`nome_fantasia.ilike.%${term}%,nome_usuario.ilike.%${term}%`)
      }
      const { data, error: e } = await query
      if (e) throw e
      setEmpresas(
        (data ?? []).map((emp) => {
          const row = emp as {
            id: string
            nome_fantasia?: string | null
            nome_usuario?: string | null
            categoria?: string | null
            cidade?: string | null
            plano?: string | null
            nota_media?: number | null
            status?: string | null
          }
          return {
            id: row.id,
            nome: row.nome_fantasia ?? '-',
            username: row.nome_usuario ?? '',
            categoria: row.categoria ?? '-',
            cidade: row.cidade ?? '-',
            plano: row.plano ?? 'Básico',
            nota: Number(row.nota_media ?? 0),
            status: row.status ?? 'ativo',
          }
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar empresas'))
    } finally {
      setLoading(false)
    }
  }, [busca])

  useEffect(() => {
    void fetchEmpresas()
  }, [fetchEmpresas])

  return { empresas, loading, error, refetch: fetchEmpresas }
}

