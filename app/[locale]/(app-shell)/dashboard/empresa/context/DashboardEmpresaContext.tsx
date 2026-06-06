'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import {
  EMPRESA_SELECT,
  mapEmpresaRow,
  type DadosEmpresa,
} from '../hooks/useDashboardEmpresa'

type Ctx = {
  dados: DadosEmpresa | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const DashboardEmpresaContext = createContext<Ctx | null>(null)

export function DashboardEmpresaProvider({
  children,
  initialData = null,
}: {
  children: ReactNode
  initialData?: DadosEmpresa | null
}) {
  const [dados, setDados] = useState<DadosEmpresa | null>(initialData)
  const [loading, setLoading] = useState(!initialData)
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
        ? await supabase.from('empresas').select(EMPRESA_SELECT).eq('id', contextoEmpresaId).maybeSingle()
        : await supabase.from('empresas').select(EMPRESA_SELECT).eq('usuario_id', uid).maybeSingle()
      if (fetchError) throw fetchError
      if (!data) {
        setDados(null)
        return
      }

      setDados(mapEmpresaRow(data as Record<string, unknown>))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar dados da empresa'))
      setDados(null)
    } finally {
      setLoading(false)
    }
  }, [contextoEmpresaId, modoAtivo, perfilSimulado?.tipo])

  useEffect(() => {
    if (initialData) {
      setDados(initialData)
      setLoading(false)
      return
    }
    void fetchEmpresa()
  }, [fetchEmpresa, initialData])

  return (
    <DashboardEmpresaContext.Provider value={{ dados, loading, error, refetch: fetchEmpresa }}>
      {children}
    </DashboardEmpresaContext.Provider>
  )
}

export function useDashboardEmpresa() {
  const ctx = useContext(DashboardEmpresaContext)
  if (!ctx) {
    throw new Error('useDashboardEmpresa deve ser usado dentro de DashboardEmpresaProvider')
  }
  return ctx
}
