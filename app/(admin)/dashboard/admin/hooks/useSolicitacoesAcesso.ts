'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from './usePermissao'
import type {
  AprovarSolicitacaoParams,
  RecusarSolicitacaoParams,
  RevogarAcessoParams,
  SolicitacaoAcesso,
  SolicitacaoPerfilTipo,
} from '../types/admin.types'

type FiltroSolicitacao = 'todas' | 'pendentes' | 'aprovadas' | 'recusadas' | 'revogadas' | 'expiradas'

type SolicitacaoRow = {
  id: string
  solicitante_id: string
  perfil_tipo: SolicitacaoPerfilTipo
  perfil_id: string
  motivo: string | null
  status: 'pendente' | 'aprovado' | 'recusado' | 'revogado' | 'expirado'
  aprovado_por: string | null
  aprovado_por_email: string | null
  aprovado_em: string | null
  recusado_por: string | null
  recusado_por_email: string | null
  recusado_em: string | null
  motivo_recusa: string | null
  revogado_por: string | null
  revogado_por_email: string | null
  revogado_em: string | null
  motivo_revogacao: string | null
  conceder_acesso_ate: string | null
  created_at: string
}

export function useSolicitacoesAcesso() {
  const { admin, nivel } = usePermissao()
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAcesso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [filtro, setFiltro] = useState<FiltroSolicitacao>('pendentes')

  const isAdminGeral = nivel === 1

  const fetchPerfilInfo = useCallback(async (tipo: SolicitacaoPerfilTipo, perfilId: string) => {
    if (tipo === 'turista') {
      const { data } = await supabase.from('turistas').select('nome_completo, nome_usuario').eq('id', perfilId).maybeSingle()
      return { nome: String(data?.nome_completo ?? ''), username: String(data?.nome_usuario ?? '') }
    }
    if (tipo === 'profissional') {
      const { data } = await supabase.from('profissionais').select('nome_completo, nome_usuario').eq('id', perfilId).maybeSingle()
      return { nome: String(data?.nome_completo ?? ''), username: String(data?.nome_usuario ?? '') }
    }
    const { data } = await supabase.from('empresas').select('nome_fantasia, nome_usuario').eq('id', perfilId).maybeSingle()
    return { nome: String(data?.nome_fantasia ?? ''), username: String(data?.nome_usuario ?? '') }
  }, [])

  const fetchSolicitacoes = useCallback(async () => {
    if (!isAdminGeral) {
      setSolicitacoes([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('solicitacoes_acesso_docs')
        .select(
          'id, solicitante_id, perfil_tipo, perfil_id, motivo, status, aprovado_por, aprovado_por_email, aprovado_em, recusado_por, recusado_por_email, recusado_em, motivo_recusa, revogado_por, revogado_por_email, revogado_em, motivo_revogacao, conceder_acesso_ate, created_at'
        )
        .order('created_at', { ascending: false })

      if (filtro === 'pendentes') query = query.eq('status', 'pendente')
      if (filtro === 'aprovadas') query = query.eq('status', 'aprovado')
      if (filtro === 'recusadas') query = query.eq('status', 'recusado')
      if (filtro === 'revogadas') query = query.eq('status', 'revogado')
      if (filtro === 'expiradas') query = query.eq('status', 'expirado')

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      const rows = (data ?? []) as SolicitacaoRow[]
      const full = await Promise.all(
        rows.map(async (row) => {
          const [solicitanteRes, perfilInfo] = await Promise.all([
            supabase.from('usuarios').select('email, username').eq('id', row.solicitante_id).maybeSingle(),
            fetchPerfilInfo(row.perfil_tipo, row.perfil_id),
          ])
          const solicitante = solicitanteRes.data

          return {
            id: row.id,
            solicitante_id: row.solicitante_id,
            solicitante_email: String(solicitante?.email ?? ''),
            solicitante_nome: String(solicitante?.username ?? ''),
            perfil_tipo: row.perfil_tipo,
            perfil_id: row.perfil_id,
            perfil_nome: perfilInfo.nome,
            perfil_username: perfilInfo.username,
            motivo: row.motivo,
            status: row.status,
            aprovado_por: row.aprovado_por,
            aprovado_por_email: row.aprovado_por_email,
            aprovado_em: row.aprovado_em,
            recusado_por: row.recusado_por,
            recusado_por_email: row.recusado_por_email,
            recusado_em: row.recusado_em,
            motivo_recusa: row.motivo_recusa,
            revogado_por: row.revogado_por,
            revogado_por_email: row.revogado_por_email,
            revogado_em: row.revogado_em,
            motivo_revogacao: row.motivo_revogacao,
            conceder_acesso_ate: row.conceder_acesso_ate,
            created_at: row.created_at,
          } satisfies SolicitacaoAcesso
        })
      )

      setSolicitacoes(full)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar solicitações'))
    } finally {
      setLoading(false)
    }
  }, [fetchPerfilInfo, filtro, isAdminGeral])

  const aprovarSolicitacao = useCallback(
    async ({ solicitacao_id, conceder_acesso_ate }: AprovarSolicitacaoParams) => {
      if (!admin) throw new Error('Admin não autenticado')

      const { error: updateError } = await supabase
        .from('solicitacoes_acesso_docs')
        .update({
          status: 'aprovado',
          aprovado_por: admin.id,
          aprovado_em: new Date().toISOString(),
          recusado_por: null,
          recusado_em: null,
          motivo_recusa: null,
          conceder_acesso_ate: conceder_acesso_ate ? conceder_acesso_ate.toISOString() : null,
        })
        .eq('id', solicitacao_id)
      if (updateError) throw updateError

      await supabase.from('logs_verificacao').insert({
        tipo: 'solicitacao_acesso',
        perfil_id: solicitacao_id,
        acao: 'aprovado_acesso',
        admin_id: admin.id,
        admin_email: admin.email ?? admin.username ?? 'admin',
        admin_nivel: admin.admin_level,
        detalhes: {
          conceder_acesso_ate: conceder_acesso_ate ? conceder_acesso_ate.toISOString() : null,
        },
      })

      await fetchSolicitacoes()
    },
    [admin, fetchSolicitacoes]
  )

  const recusarSolicitacao = useCallback(
    async ({ solicitacao_id, motivo }: RecusarSolicitacaoParams) => {
      if (!admin) throw new Error('Admin não autenticado')
      if (!motivo.trim()) throw new Error('Motivo da recusa é obrigatório')

      const { error: updateError } = await supabase
        .from('solicitacoes_acesso_docs')
        .update({
          status: 'recusado',
          recusado_por: admin.id,
          recusado_em: new Date().toISOString(),
          motivo_recusa: motivo.trim(),
          aprovado_por: null,
          aprovado_em: null,
          conceder_acesso_ate: null,
        })
        .eq('id', solicitacao_id)
      if (updateError) throw updateError

      await supabase.from('logs_verificacao').insert({
        tipo: 'solicitacao_acesso',
        perfil_id: solicitacao_id,
        acao: 'recusado_acesso',
        admin_id: admin.id,
        admin_email: admin.email ?? admin.username ?? 'admin',
        admin_nivel: admin.admin_level,
        detalhes: { motivo_recusa: motivo.trim() },
      })

      await fetchSolicitacoes()
    },
    [admin, fetchSolicitacoes]
  )

  const revogarAcesso = useCallback(
    async ({ solicitacao_id, motivo }: RevogarAcessoParams) => {
      if (!motivo.trim()) throw new Error('Motivo da revogação é obrigatório')
      const { error: rpcError } = await supabase.rpc('revogar_acesso_documentos', {
        p_solicitacao_id: solicitacao_id,
        p_motivo: motivo.trim(),
      })
      if (rpcError) throw rpcError
      await fetchSolicitacoes()
    },
    [fetchSolicitacoes]
  )

  const executarLimpezaExpirados = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('executar_limpeza_acessos_expirados')
    if (rpcError) throw rpcError
    await fetchSolicitacoes()
    return data as { quantidade_expirados?: number; total_expirados?: number } | null
  }, [fetchSolicitacoes])

  useEffect(() => {
    void fetchSolicitacoes()
  }, [fetchSolicitacoes])

  return {
    solicitacoes,
    loading,
    error,
    filtro,
    setFiltro,
    aprovarSolicitacao,
    recusarSolicitacao,
    revogarAcesso,
    executarLimpezaExpirados,
    refetch: fetchSolicitacoes,
    isAdminGeral,
  }
}
