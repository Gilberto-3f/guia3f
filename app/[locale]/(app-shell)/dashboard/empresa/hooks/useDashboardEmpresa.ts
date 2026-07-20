'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

export interface DadosEmpresa {
  id: string
  usuario_id: string | null
  nome: string
  username: string
  categoria: string
  cidade: string
  plano: string
  nota_media: number
  total_avaliacoes: number
  verificado: boolean
  whatsapp?: string | null
  whatsapp_comercial?: string | null
  /** Moeda de cadastro/exibição do catálogo (USD|BRL|ARS|PYG). */
  moeda_padrao?: string | null
  preco_ticket_inteira?: number | null
  preco_ticket_meia?: number | null
  preco_diaria?: number | null
  somente_anfitriao?: boolean
}

export const EMPRESA_SELECT =
  'id, usuario_id, nome_fantasia, nome_usuario, categoria, cidade, plano, nota_media, total_avaliacoes, docs_verificado, status, whatsapp, whatsapp_comercial, moeda_padrao, preco_ticket_inteira, preco_ticket_meia, preco_diaria, somente_anfitriao'

export type DashboardEmpresaCtx = {
  dados: DadosEmpresa | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export const DashboardEmpresaContext = createContext<DashboardEmpresaCtx | null>(null)

function asString(v: unknown, fallback = '') {
  return v != null ? String(v) : fallback
}

function asNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function mapEmpresaRow(data: Record<string, unknown>): DadosEmpresa {
  const status = asString(data.status, '')
  return {
    id: asString(data.id),
    usuario_id: data.usuario_id != null ? asString(data.usuario_id) : null,
    nome: asString(data.nome_fantasia, 'Empresa'),
    username: asString(data.nome_usuario, ''),
    categoria: asString(data.categoria, ''),
    cidade: asString(data.cidade, ''),
    plano: asString(data.plano, 'gratuito'),
    nota_media: asNumber(data.nota_media, 0),
    total_avaliacoes: asNumber(data.total_avaliacoes, 0),
    verificado: Boolean(data.docs_verificado) || status === 'ativo',
    whatsapp: data.whatsapp != null ? asString(data.whatsapp) : null,
    whatsapp_comercial: data.whatsapp_comercial != null ? asString(data.whatsapp_comercial) : null,
    moeda_padrao: data.moeda_padrao != null ? asString(data.moeda_padrao) : 'USD',
    preco_ticket_inteira:
      data.preco_ticket_inteira != null ? asNumber(data.preco_ticket_inteira, 0) : null,
    preco_ticket_meia: data.preco_ticket_meia != null ? asNumber(data.preco_ticket_meia, 0) : null,
    preco_diaria: data.preco_diaria != null ? asNumber(data.preco_diaria, 0) : null,
    somente_anfitriao: Boolean(data.somente_anfitriao),
  }
}

export function useEmpresaState(initialData?: DadosEmpresa | null, enabled = true): DashboardEmpresaCtx {
  const [dados, setDados] = useState<DadosEmpresa | null>(enabled ? (initialData ?? null) : null)
  const [loading, setLoading] = useState(enabled && !initialData)
  const [error, setError] = useState<Error | null>(null)
  const { modoAtivo, perfilSimulado, contextoEmpresaId } = useModoApresentacao()

  const fetchEmpresa = useCallback(async () => {
    if (!enabled) return

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
  }, [contextoEmpresaId, enabled, modoAtivo, perfilSimulado?.tipo])

  useEffect(() => {
    if (!enabled) return
    if (initialData) {
      setDados(initialData)
      setLoading(false)
      return
    }
    void fetchEmpresa()
  }, [enabled, fetchEmpresa, initialData])

  return { dados, loading, error, refetch: fetchEmpresa }
}

export function useDashboardEmpresa(): DashboardEmpresaCtx {
  const ctx = useContext(DashboardEmpresaContext)
  const local = useEmpresaState(null, ctx === null)
  return ctx ?? local
}
