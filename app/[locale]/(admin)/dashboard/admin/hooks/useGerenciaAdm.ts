'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from './usePermissao'

export type AdminRow = {
  id: string
  email: string
  nome: string
  nome_social: string
  username: string
  foto_url: string | null
  role: string
  admin_level: number
  cargo: string
  comunidade: string | null
  pais: string | null
  participacao_percentual: number | null
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

  const buscarUsuarioExato = useCallback(
    async (termo: string) => {
      if (!isAdminGeral) return null
      const q = termo.trim().replace(/^@+/, '')
      if (q.length < 2) return null
      const res = await fetch(`/api/admin/convites/buscar-usuario?q=${encodeURIComponent(q)}`, {
        credentials: 'include',
      })
      const json = (await res.json()) as {
        ok?: boolean
        usuario?: {
          id: string
          username: string
          nome_social: string
          foto_url: string | null
        } | null
      }
      if (!res.ok || !json.ok || !json.usuario) return null
      return json.usuario
    },
    [isAdminGeral],
  )

  const buscarUsuariosPorUsername = useCallback(
    async (username: string) => {
      const u = await buscarUsuarioExato(username)
      return u ? [{ ...u, nome_exibicao: u.nome_social, nome_usuario: u.username }] : []
    },
    [buscarUsuarioExato],
  )

  const buscarUsuariosPorEmail = buscarUsuariosPorUsername

  const listarAdmins = useCallback(async () => {
    if (!isAdminGeral) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('usuarios')
        .select('id, email, nome_completo, username, role, admin_level, admin_permissoes, created_at')
        .eq('role', 'admin')
      if (e) throw e

      const rows = data ?? []
      const ids = rows.map((r) => String((r as { id: string }).id))
      const perfilMap = new Map<string, { nome: string; username: string; foto: string | null }>()

      if (ids.length > 0) {
        const [{ data: profs }, { data: turistas }] = await Promise.all([
          supabase.from('profissionais').select('usuario_id, nome_completo, nome_usuario, foto_perfil_url').in('usuario_id', ids),
          supabase.from('turistas').select('usuario_id, nome, nome_usuario, foto_url').in('usuario_id', ids),
        ])
        for (const p of profs ?? []) {
          const uid = String(p.usuario_id)
          perfilMap.set(uid, {
            nome: String(p.nome_completo ?? p.nome_usuario ?? ''),
            username: String(p.nome_usuario ?? '').replace(/^@+/, ''),
            foto: p.foto_perfil_url != null ? String(p.foto_perfil_url) : null,
          })
        }
        for (const t of turistas ?? []) {
          const uid = String(t.usuario_id)
          if (!perfilMap.has(uid)) {
            perfilMap.set(uid, {
              nome: String(t.nome ?? t.nome_usuario ?? ''),
              username: String(t.nome_usuario ?? '').replace(/^@+/, ''),
              foto: t.foto_url != null ? String(t.foto_url) : null,
            })
          }
        }
      }

      setAdmins(
        rows.map((row) => {
          const r = row as {
            id: string
            email?: string | null
            nome_completo?: string | null
            username?: string | null
            role?: string | null
            admin_level?: number | null
            admin_permissoes?: {
              cargo?: string | null
              comunidade?: string | null
              pais?: string | null
              participacao_percentual?: number | null
            }
            created_at?: string | null
          }
          const perf = perfilMap.get(String(r.id))
          const perms = r.admin_permissoes ?? {}
          const pct = perms.participacao_percentual
          return {
            id: r.id,
            email: r.email ?? '',
            nome: r.nome_completo ?? r.email ?? r.id,
            nome_social: perf?.nome || r.nome_completo || r.email || '',
            username: perf?.username || String(r.username ?? '').replace(/^@+/, '') || r.email?.split('@')[0] || '',
            foto_url: perf?.foto ?? null,
            role: r.role ?? 'admin',
            admin_level: r.admin_level ?? 0,
            cargo: perms.cargo ?? '',
            comunidade: perms.comunidade ?? null,
            pais: perms.pais ?? null,
            participacao_percentual:
              pct != null && Number.isFinite(Number(pct)) ? Number(pct) : null,
            permissoes: r.admin_permissoes ?? {},
            created_at: r.created_at ?? new Date().toISOString(),
          }
        }),
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
        const cargo = nivel === 2 ? 'MODERADOR' : nivel === 3 ? 'FINANCEIRO' : 'AUXILIAR_ADM'
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
    async (usuarioId: string, nivel: number, comunidade?: string, pais?: string) => {
      if (!isAdminGeral || !admin) throw new Error('Apenas ADM GERAL')
      const res = await fetch('/api/admin/convites/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          usuario_id: usuarioId,
          nivel,
          comunidade: comunidade ?? null,
          pais: pais ?? null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Não foi possível enviar o convite.')
      }
      return json
    },
    [admin, isAdminGeral],
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

  const atualizarBonificacao = useCallback(
    async (usuarioId: string, participacaoPercentual: number) => {
      if (!isAdminGeral) throw new Error('Apenas ADM GERAL')
      const res = await fetch('/api/admin/colaboradores/bonificacao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ usuario_id: usuarioId, participacao_percentual: participacaoPercentual }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Não foi possível salvar o percentual.')
      }
      await listarAdmins()
      return json
    },
    [isAdminGeral, listarAdmins],
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
    buscarUsuariosPorUsername,
    buscarUsuarioExato,
    criarAdmin,
    atualizarAdmin,
    removerAdmin,
    criarConvite,
    atualizarBonificacao,
    listarAdmins,
    listarConvites,
    listarPagamentosColaboradores,
    marcarPagamentoComoPago,
  }
}

