'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

export interface DadosEmpresa {
  id: string
  nome: string
  username: string
  categoria: string
  cidade: string
  plano: string
  nota_media: number
  total_avaliacoes: number
  verificado: boolean
}

function asString(v: unknown, fallback = '') {
  return v != null ? String(v) : fallback
}

function asNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function useDashboardEmpresa() {
  const [dados, setDados] = useState<DadosEmpresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { modoAtivo, perfilSimulado, contextoEmpresaId } = useModoApresentacao()

  const fetchEmpresa = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!uid) {
        setDados(null)
        return
      }

      const simEmpresa = modoAtivo && perfilSimulado?.tipo === 'empresa' && contextoEmpresaId

      const { data, error: fetchError } = simEmpresa
        ? await supabase.from('empresas').select('*').eq('id', contextoEmpresaId).maybeSingle()
        : await supabase.from('empresas').select('*').eq('usuario_id', uid).maybeSingle()
      if (fetchError) throw fetchError
      if (!data) {
        setDados(null)
        return
      }

      const row = data as Record<string, unknown>
      const status = asString(row.status, '')

      setDados({
        id: asString(row.id),
        nome: asString(row.nome_fantasia, 'Empresa'),
        username: asString(row.nome_usuario, ''),
        categoria: asString(row.categoria, ''),
        cidade: asString(row.cidade, ''),
        plano: asString(row.plano, 'Básico'),
        nota_media: asNumber(row.nota_media, 0),
        total_avaliacoes: asNumber(row.total_avaliacoes, 0),
        verificado: Boolean(row.docs_verificado) || status === 'ativo',
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar dados da empresa'))
      setDados(null)
    } finally {
      setLoading(false)
    }
  }, [contextoEmpresaId, modoAtivo, perfilSimulado?.tipo])

  useEffect(() => {
    void fetchEmpresa()
  }, [fetchEmpresa])

  return { dados, loading, error, refetch: fetchEmpresa }
}

