'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from './usePermissao'

export type ConfiguracoesComissoes = {
  empresa_split: { regular: number; indicador: number }
  servico_particular: {
    taxa: number
    modelo_com_indicacao: { regular: number; indicador: number; empresa_parceira: number; plataforma: number }
    modelo_sem_indicacao: { regular: number; empresa_parceira: number; plataforma: number }
  }
  tickets_reservas: {
    profissional_indicador: number
    parceiro_indicador: number
    empresa_parceira: number
    plataforma: number
  }
  mobilidade_tabelada: {
    taxa: number
    regular: number
    indicador: number
    plataforma: number
  }
  mobilidade_urbana: { taxa: number }
}

export type Plano = {
  id: string
  nome: 'BASICO' | 'PREMIUM' | 'ENTERPRISE'
  valor: number
  recursos: Record<string, unknown>
  ativo: boolean
}

const DEFAULT_CONFIG: ConfiguracoesComissoes = {
  empresa_split: { regular: 50, indicador: 50 },
  servico_particular: {
    taxa: 20,
    modelo_com_indicacao: { regular: 50, indicador: 30, empresa_parceira: 10, plataforma: 10 },
    modelo_sem_indicacao: { regular: 70, empresa_parceira: 10, plataforma: 20 },
  },
  tickets_reservas: {
    profissional_indicador: 70,
    parceiro_indicador: 20,
    empresa_parceira: 5,
    plataforma: 5,
  },
  mobilidade_tabelada: {
    taxa: 15,
    regular: 60,
    indicador: 30,
    plataforma: 10,
  },
  mobilidade_urbana: { taxa: 0 },
}

export function useFinanceiroAdm() {
  const { admin } = usePermissao()
  const [config, setConfig] = useState<ConfiguracoesComissoes | null>(null)
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isAdminFinanceiro = Boolean(admin && (admin.admin_level === 1 || (admin.admin_permissoes as any)?.cargo === 'FINANCEIRO'))

  const fetchConfiguracoes = useCallback(async () => {
    if (!isAdminFinanceiro) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('config_comissoes')
        .select('id, versao, dados')
        .eq('ativo', true)
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (e && e.code !== 'PGRST116') throw e
      if (data?.dados) {
        setConfig(data.dados as ConfiguracoesComissoes)
      } else {
        setConfig(DEFAULT_CONFIG)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar configurações'))
      setConfig(DEFAULT_CONFIG)
    } finally {
      setLoading(false)
    }
  }, [isAdminFinanceiro])

  const fetchPlanos = useCallback(async () => {
    if (!isAdminFinanceiro) return
    try {
      const { data, error: e } = await supabase.from('planos').select('*').eq('ativo', true).order('valor', { ascending: true })
      if (e) throw e
      setPlanos(
        (data ?? []).map((p) => {
          const row = p as { id: string; nome: string; valor: number; recursos: Record<string, unknown>; ativo: boolean }
          return {
            id: row.id,
            nome: row.nome as Plano['nome'],
            valor: Number(row.valor ?? 0),
            recursos: row.recursos ?? {},
            ativo: row.ativo,
          }
        })
      )
    } catch (err) {
      console.error(err)
    }
  }, [isAdminFinanceiro])

  const salvarConfiguracoes = useCallback(
    async (novaConfig: ConfiguracoesComissoes) => {
      if (!isAdminFinanceiro || !admin) return { success: false, error: new Error('Sem permissão') }
      setLoading(true)
      setError(null)
      try {
        const { data: atualArr, error: curErr } = await supabase
          .from('config_comissoes')
          .select('id, versao, dados')
          .eq('ativo', true)
          .order('versao', { ascending: false })
          .limit(1)
        if (curErr) throw curErr
        const atual = atualArr?.[0] as { id: string; versao: number; dados: unknown } | undefined
        const novaVersao = (atual?.versao ?? 0) + 1

        if (atual) {
          await supabase.from('config_comissoes').update({ ativo: false }).eq('id', atual.id)
        }

        const { error: insErr } = await supabase.from('config_comissoes').insert({
          versao: novaVersao,
          dados: novaConfig,
          criado_por: admin.id,
          ativo: true,
        })
        if (insErr) throw insErr

        await supabase.from('historico_comissoes').insert({
          tipo: 'config_comissoes',
          config_anterior: atual?.dados ?? null,
          config_nova: novaConfig,
          alterado_por: admin.id,
        })

        await supabase.from('logs_verificacao').insert({
          tipo: 'financeiro',
          perfil_id: admin.id,
          acao: 'atualizou_config_comissoes',
          admin_id: admin.id,
          admin_email: admin.email ?? admin.username ?? 'admin',
          admin_nivel: admin.admin_level,
          detalhes: { versao: novaVersao },
        })

        setConfig(novaConfig)
        return { success: true }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao salvar configurações'))
        return { success: false, error: err }
      } finally {
        setLoading(false)
      }
    },
    [admin, isAdminFinanceiro]
  )

  const salvarPlano = useCallback(
    async (plano: Plano) => {
      if (!isAdminFinanceiro || !admin) return { success: false, error: new Error('Sem permissão') }
      setLoading(true)
      try {
        const { error: upErr } = await supabase
          .from('planos')
          .update({
            valor: plano.valor,
            recursos: plano.recursos,
            atualizado_por: admin.id,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', plano.id)
        if (upErr) throw upErr

        await supabase.from('logs_verificacao').insert({
          tipo: 'financeiro',
          perfil_id: admin.id,
          acao: 'atualizou_plano',
          admin_id: admin.id,
          admin_email: admin.email ?? admin.username ?? 'admin',
          admin_nivel: admin.admin_level,
          detalhes: { plano: plano.nome, novo_valor: plano.valor },
        })

        await fetchPlanos()
        return { success: true }
      } catch (err) {
        return { success: false, error: err }
      } finally {
        setLoading(false)
      }
    },
    [admin, fetchPlanos, isAdminFinanceiro]
  )

  useEffect(() => {
    if (isAdminFinanceiro) {
      void fetchConfiguracoes()
      void fetchPlanos()
    }
  }, [fetchConfiguracoes, fetchPlanos, isAdminFinanceiro])

  return { config, planos, loading, error, salvarConfiguracoes, salvarPlano, isAdminFinanceiro, refetch: fetchConfiguracoes }
}

