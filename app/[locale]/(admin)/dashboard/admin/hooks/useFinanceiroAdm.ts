'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  type PlanoCorId,
  type ServicoPlanoId,
  slugPlanoNome,
} from '@/lib/planosEmpresaCatalogo'
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

export type PlanoEmpresaAdm = {
  id: string
  nome: string
  titulo: string
  cor: PlanoCorId
  descricao: string
  servicos: ServicoPlanoId[]
  precoMensal: number
  precoTrimestral: number
  precoAnual: number
  valor: number
  recursos: Record<string, unknown>
  ativo: boolean
  ordem: number
}

export type PlanoFormInput = Omit<PlanoEmpresaAdm, 'id' | 'nome' | 'valor' | 'recursos' | 'ativo' | 'ordem'> & {
  id?: string
  nome?: string
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

function isErroSchemaAusente(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === 'PGRST205' || err.code === 'PGRST204' || err.code === '42P01') return true
  return /could not find the table|could not find the '.+' column/i.test(String(err.message ?? ''))
}

function buildRecursosFromRow(row: Record<string, unknown>): Record<string, unknown> {
  const raw = row.recursos
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }

  const servicosRaw = row.servicos
  const servicos = Array.isArray(servicosRaw)
    ? servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
    : []

  return {
    servicos,
    cor: row.cor ?? 'azul',
    descricao: row.descricao ?? '',
    precos: {
      mensal: Number(row.preco_mensal ?? row.valor ?? 0),
      trimestral: Number(row.preco_trimestral ?? 0),
      anual: Number(row.preco_anual ?? 0),
    },
  }
}

function mapPlanoRow(row: Record<string, unknown>): PlanoEmpresaAdm {
  const servicosRaw = row.servicos
  const servicos = Array.isArray(servicosRaw)
    ? servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
    : []

  const precoMensal = Number(row.preco_mensal ?? row.valor ?? 0)

  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    titulo: String(row.titulo ?? row.nome ?? 'Plano'),
    cor: (String(row.cor ?? 'azul') as PlanoCorId) || 'azul',
    descricao: String(row.descricao ?? ''),
    servicos,
    precoMensal,
    precoTrimestral: Number(row.preco_trimestral ?? 0),
    precoAnual: Number(row.preco_anual ?? 0),
    valor: precoMensal,
    recursos: buildRecursosFromRow(row),
    ativo: row.ativo !== false,
    ordem: Number(row.ordem ?? 0),
  }
}

export function useFinanceiroAdm() {
  const { admin } = usePermissao()
  const [config, setConfig] = useState<ConfiguracoesComissoes | null>(null)
  const [planos, setPlanos] = useState<PlanoEmpresaAdm[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPlanos, setLoadingPlanos] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isAdminFinanceiro = Boolean(
    admin && (admin.admin_level === 1 || (admin.admin_permissoes as { cargo?: string })?.cargo === 'FINANCEIRO'),
  )

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

      if (e && e.code !== 'PGRST116' && !isErroSchemaAusente(e)) throw e
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
    setLoadingPlanos(true)
    try {
      const { data, error: e } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('preco_mensal', { ascending: true })
      if (e) throw e
      setPlanos((data ?? []).map((p) => mapPlanoRow(p as Record<string, unknown>)))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingPlanos(false)
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
        if (curErr && !isErroSchemaAusente(curErr)) throw curErr
        if (isErroSchemaAusente(curErr)) {
          return {
            success: false,
            error: new Error(
              'Tabela config_comissoes não encontrada no banco. Aplique a migration financeiro_planos_comissoes_fixup no Supabase.',
            ),
          }
        }
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
        }).then(({ error: histErr }) => {
          if (histErr && !isErroSchemaAusente(histErr)) console.warn('historico_comissoes:', histErr.message)
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
    [admin, isAdminFinanceiro],
  )

  const salvarPlano = useCallback(
    async (input: PlanoFormInput) => {
      if (!isAdminFinanceiro || !admin) return { success: false, error: new Error('Sem permissão') }
      if (!input.titulo.trim()) return { success: false, error: new Error('Título obrigatório') }

      setLoadingPlanos(true)
      try {
        const payload = {
          titulo: input.titulo.trim(),
          cor: input.cor,
          descricao: input.descricao.trim().slice(0, 1500),
          servicos: input.servicos,
          preco_mensal: input.precoMensal,
          preco_trimestral: input.precoTrimestral,
          preco_anual: input.precoAnual,
          valor: input.precoMensal,
        }

        if (input.id) {
          const { error: upErr } = await supabase.from('planos').update(payload).eq('id', input.id)
          if (upErr) throw upErr
        } else {
          const nome = slugPlanoNome(input.titulo)
          const ordem = planos.length
          const { error: insErr } = await supabase.from('planos').insert({
            ...payload,
            nome,
            ordem,
            ativo: true,
          })
          if (insErr) throw insErr
        }

        await supabase.from('logs_verificacao').insert({
          tipo: 'financeiro',
          perfil_id: admin.id,
          acao: input.id ? 'atualizou_plano' : 'criou_plano',
          admin_id: admin.id,
          admin_email: admin.email ?? admin.username ?? 'admin',
          admin_nivel: admin.admin_level,
          detalhes: { plano: input.titulo.trim(), preco_mensal: input.precoMensal },
        })

        await fetchPlanos()
        return { success: true }
      } catch (err) {
        return { success: false, error: err }
      } finally {
        setLoadingPlanos(false)
      }
    },
    [admin, fetchPlanos, isAdminFinanceiro, planos.length],
  )

  const excluirPlano = useCallback(
    async (planoId: string) => {
      if (!isAdminFinanceiro || !admin) return { success: false, error: new Error('Sem permissão') }
      if (!planoId.trim()) return { success: false, error: new Error('Plano inválido') }

      setLoadingPlanos(true)
      try {
        const alvo = planos.find((p) => p.id === planoId)
        const { error: delErr } = await supabase.from('planos').delete().eq('id', planoId)
        if (delErr) throw delErr

        await supabase.from('logs_verificacao').insert({
          tipo: 'financeiro',
          perfil_id: admin.id,
          acao: 'excluiu_plano',
          admin_id: admin.id,
          admin_email: admin.email ?? admin.username ?? 'admin',
          admin_nivel: admin.admin_level,
          detalhes: { plano: alvo?.titulo ?? planoId },
        })

        await fetchPlanos()
        return { success: true }
      } catch (err) {
        return { success: false, error: err }
      } finally {
        setLoadingPlanos(false)
      }
    },
    [admin, fetchPlanos, isAdminFinanceiro, planos],
  )

  useEffect(() => {
    if (isAdminFinanceiro) {
      void fetchConfiguracoes()
      void fetchPlanos()
    }
  }, [fetchConfiguracoes, fetchPlanos, isAdminFinanceiro])

  return {
    config,
    planos,
    loading,
    loadingPlanos,
    error,
    salvarConfiguracoes,
    salvarPlano,
    excluirPlano,
    isAdminFinanceiro,
    refetch: fetchConfiguracoes,
    refetchPlanos: fetchPlanos,
  }
}

/** @deprecated Use PlanoEmpresaAdm */
export type Plano = PlanoEmpresaAdm
