'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from './usePermissao'

export type AdminRow = {
  id: string
  email: string
  nome: string
  role: string
  admin_level: number
  cargo: string
  comunidade: string | null
  permissoes: unknown
  created_at: string
}

export type Admin = AdminRow

export type ConviteAdminRow = {
  id: string
  email: string
  nivel: number
  comunidade: string | null
  status: string
  convidado_por: string | null
  convidado_em: string
  expira_em: string
}

export type PagamentoColaboradorRow = {
  id: string
  colaborador_id: string
  colaborador_nome: string
  colaborador_email: string
  mes_ref: number
  ano_ref: number
  valor: number
  participacao_percentual: number
  base_calculo: number
  status: string
  pago_em: string | null
}

export function useGerenciaAdm() {
  const { admin } = usePermissao()
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [convites, setConvites] = useState<ConviteAdminRow[]>([])
  const [pagamentos, setPagamentos] = useState<PagamentoColaboradorRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isAdminGeral = admin?.admin_level === 1

  const buscarUsuariosPorEmail = useCallback(
    async (email: string) => {
      if (!isAdminGeral || email.trim().length < 3) return []
      const { data, error: e } = await supabase
        .from('usuarios')
        .select('id, email, nome_completo, role, admin_level')
        .ilike('email', `%${email.trim()}%`)
        .limit(10)
      if (e) throw e
      return data ?? []
    },
    [isAdminGeral]
  )

  const listarAdmins = useCallback(async () => {
    if (!isAdminGeral) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase.from('usuarios').select('id, email, nome_completo, role, admin_level, admin_permissoes, created_at').eq('role', 'admin')
      if (e) throw e
      setAdmins(
        (data ?? []).map((row) => {
          const r = row as {
            id: string
            email?: string | null
            nome_completo?: string | null
            role?: string | null
            admin_level?: number | null
            admin_permissoes?: { cargo?: string | null; comunidade?: string | null }
            created_at?: string | null
          }
          return {
            id: r.id,
            email: r.email ?? '',
            nome: r.nome_completo ?? r.email ?? r.id,
            role: r.role ?? 'admin',
            admin_level: r.admin_level ?? 0,
            cargo: r.admin_permissoes?.cargo ?? '',
            comunidade: r.admin_permissoes?.comunidade ?? null,
            permissoes: r.admin_permissoes ?? {},
            created_at: r.created_at ?? new Date().toISOString(),
          }
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao listar admins'))
    } finally {
      setLoading(false)
    }
  }, [isAdminGeral])

  const criarAdmin = useCallback(
    async (usuarioId: string, nivel: number, comunidade?: string, permissoes?: { modulos?: string[]; recursos?: string[] }) => {
      if (!isAdminGeral || !admin) throw new Error('Apenas ADM GERAL')
      setLoading(true)
      try {
        const cargo = nivel === 2 ? 'MODERADOR' : nivel === 3 ? 'FINANCEIRO' : 'SUPORTE'
        const { error: upErr } = await supabase
          .from('usuarios')
          .update({
            role: 'admin',
            admin_level: nivel,
            admin_permissoes: {
              nivel,
              cargo,
              comunidade: comunidade ?? null,
              modulos: permissoes?.modulos ?? [],
              recursos: permissoes?.recursos ?? [],
            },
          })
          .eq('id', usuarioId)
        if (upErr) throw upErr

        await supabase.from('logs_verificacao').insert({
          tipo: 'admin',
          perfil_id: usuarioId,
          acao: 'criou_admin',
          admin_id: admin.id,
          admin_email: admin.email ?? admin.username ?? 'admin',
          admin_nivel: admin.admin_level,
          detalhes: { nivel, cargo, comunidade: comunidade ?? null },
        })

        await listarAdmins()
        return { success: true }
      } catch (err) {
        return { success: false, error: err }
      } finally {
        setLoading(false)
      }
    },
    [admin, isAdminGeral, listarAdmins]
  )

  const atualizarAdmin = useCallback(
    async (usuarioId: string, updates: Partial<AdminRow>) => {
      if (!isAdminGeral || !admin) throw new Error('Apenas ADM GERAL')
      setLoading(true)
      try {
        const cargo = updates.cargo
        const nivel = updates.admin_level
        const comunidade = updates.comunidade
        const permissoes = updates.permissoes as { modulos?: string[]; recursos?: string[] } | undefined
        const { error: upErr } = await supabase
          .from('usuarios')
          .update({
            admin_level: nivel,
            admin_permissoes: {
              nivel,
              cargo,
              comunidade: comunidade ?? null,
              modulos: permissoes?.modulos ?? [],
              recursos: permissoes?.recursos ?? [],
            },
          })
          .eq('id', usuarioId)
        if (upErr) throw upErr

        await supabase.from('logs_verificacao').insert({
          tipo: 'admin',
          perfil_id: usuarioId,
          acao: 'atualizou_admin',
          admin_id: admin.id,
          admin_email: admin.email ?? admin.username ?? 'admin',
          admin_nivel: admin.admin_level,
          detalhes: { nivel, cargo, comunidade: comunidade ?? null },
        })

        await listarAdmins()
        return { success: true }
      } catch (err) {
        return { success: false, error: err }
      } finally {
        setLoading(false)
      }
    },
    [admin, isAdminGeral, listarAdmins]
  )

  const removerAdmin = useCallback(
    async (usuarioId: string) => {
      if (!isAdminGeral || !admin) throw new Error('Apenas ADM GERAL')
      setLoading(true)
      try {
        const { error: upErr } = await supabase
          .from('usuarios')
          .update({ role: 'user', admin_level: null, admin_permissoes: null })
          .eq('id', usuarioId)
        if (upErr) throw upErr

        await supabase.from('logs_verificacao').insert({
          tipo: 'admin',
          perfil_id: usuarioId,
          acao: 'removeu_admin',
          admin_id: admin.id,
          admin_email: admin.email ?? admin.username ?? 'admin',
          admin_nivel: admin.admin_level,
          detalhes: {},
        })

        await listarAdmins()
        return { success: true }
      } catch (err) {
        return { success: false, error: err }
      } finally {
        setLoading(false)
      }
    },
    [admin, isAdminGeral, listarAdmins]
  )

  const criarConvite = useCallback(
    async (email: string, nivel: number, comunidade?: string, permissoes?: unknown) => {
      if (!isAdminGeral || !admin) throw new Error('Apenas ADM GERAL')
      const codigo = Math.random().toString(36).slice(2, 10).toUpperCase()
      const { data, error: e } = await supabase
        .from('convites_admin')
        .insert({
          email,
          nivel,
          comunidade: comunidade ?? null,
          permissoes: permissoes ?? {},
          convidado_por: admin.id,
          codigo,
          expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .maybeSingle()
      if (e) throw e
      await supabase.from('logs_verificacao').insert({
        tipo: 'admin',
        perfil_id: admin.id,
        acao: 'criou_convite_admin',
        admin_id: admin.id,
        admin_email: admin.email ?? admin.username ?? 'admin',
        admin_nivel: admin.admin_level,
        detalhes: { email, nivel, comunidade: comunidade ?? null },
      })
      await listarConvites()
      return data
    },
    [admin, isAdminGeral]
  )

  const listarConvites = useCallback(async () => {
    if (!isAdminGeral) return
    const { data, error: e } = await supabase.from('convites_admin').select('*').order('convidado_em', { ascending: false })
    if (e) throw e
    setConvites(
      (data ?? []).map((row) => {
        const r = row as {
          id: string
          email: string
          nivel: number
          comunidade?: string | null
          status: string
          convidado_por?: string | null
          convidado_em?: string | null
          expira_em?: string | null
        }
        return {
          id: r.id,
          email: r.email,
          nivel: r.nivel,
          comunidade: r.comunidade ?? null,
          status: r.status,
          convidado_por: r.convidado_por ?? null,
          convidado_em: r.convidado_em ?? new Date().toISOString(),
          expira_em: r.expira_em ?? new Date().toISOString(),
        }
      })
    )
  }, [isAdminGeral])

  const listarPagamentosColaboradores = useCallback(
    async (ano?: number, mes?: number) => {
      if (!isAdminGeral) return
      const now = new Date()
      const anoRef = ano ?? now.getFullYear()
      const mesRef = mes ?? now.getMonth() + 1
      const { data, error: e } = await supabase
        .from('pagamentos_colaboradores')
        .select('id, colaborador_id, mes_ref, ano_ref, valor, participacao_percentual, base_calculo, status, pago_em, colaborador:colaborador_id(email, nome_completo)')
        .eq('ano_ref', anoRef)
        .eq('mes_ref', mesRef)
        .order('valor', { ascending: false })
      if (e) throw e
      setPagamentos(
        (data ?? []).map((row) => {
          const r = row as {
            id: string
            colaborador_id: string
            mes_ref: number
            ano_ref: number
            valor: number
            participacao_percentual: number
            base_calculo: number
            status: string
            pago_em?: string | null
            colaborador?: { email?: string | null; nome_completo?: string | null }
          }
          return {
            id: r.id,
            colaborador_id: r.colaborador_id,
            colaborador_nome: r.colaborador?.nome_completo ?? r.colaborador?.email ?? '',
            colaborador_email: r.colaborador?.email ?? '',
            mes_ref: r.mes_ref,
            ano_ref: r.ano_ref,
            valor: Number(r.valor ?? 0),
            participacao_percentual: Number(r.participacao_percentual ?? 0),
            base_calculo: Number(r.base_calculo ?? 0),
            status: r.status,
            pago_em: r.pago_em ?? null,
          }
        })
      )
    },
    [isAdminGeral]
  )

  const marcarPagamentoComoPago = useCallback(
    async (pagamentoId: string) => {
      if (!isAdminGeral || !admin) throw new Error('Apenas ADM GERAL')
      const { error: e } = await supabase
        .from('pagamentos_colaboradores')
        .update({ status: 'pago', pago_em: new Date().toISOString(), pago_por: admin.id })
        .eq('id', pagamentoId)
      if (e) throw e
      await supabase.from('logs_verificacao').insert({
        tipo: 'financeiro',
        perfil_id: admin.id,
        acao: 'pagou_colaborador',
        admin_id: admin.id,
        admin_email: admin.email ?? admin.username ?? 'admin',
        admin_nivel: admin.admin_level,
        detalhes: { pagamentoId },
      })
    },
    [admin, isAdminGeral]
  )

  useEffect(() => {
    if (isAdminGeral) {
      void listarAdmins()
      void listarConvites()
    }
  }, [isAdminGeral, listarAdmins, listarConvites])

  return {
    admins,
    convites,
    pagamentos,
    loading,
    error,
    isAdminGeral,
    buscarUsuariosPorEmail,
    criarAdmin,
    atualizarAdmin,
    removerAdmin,
    criarConvite,
    listarAdmins,
    listarConvites,
    listarPagamentosColaboradores,
    marcarPagamentoComoPago,
  }
}

