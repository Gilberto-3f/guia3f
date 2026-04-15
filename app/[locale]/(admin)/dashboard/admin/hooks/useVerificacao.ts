'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  ContadoresVerificacao,
  PendenteEmpresa,
  PendenteProfissional,
  PendenteTurista,
  PerfilVerificacao,
  PeriodoVerificacao,
} from '../types/admin.types'
import { getPeriodoVerificacaoDate, normalizeBusca } from '../utils/adminHelpers'
import { usePermissao } from './usePermissao'

/** JSONB ou coluna legada: normaliza para string[]. */
function parseCategoriasProfissional(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v))
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown
      return Array.isArray(p) ? p.map((v) => String(v)) : []
    } catch {
      return []
    }
  }
  return []
}

/** Migração usa `fotos_url`; API de cadastro pode usar `fotos_urls`. */
function parseFotosEmpresa(r: Record<string, unknown>): string[] {
  const raw = r.fotos_urls ?? r.fotos_url
  if (Array.isArray(raw)) return raw.map((v) => String(v))
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown
      return Array.isArray(p) ? p.map((v) => String(v)) : []
    } catch {
      return []
    }
  }
  return []
}

export type FiltrosVerificacao = {
  perfil: PerfilVerificacao
  periodo: PeriodoVerificacao
  busca: string
  categoria?: string
}

type PendenteUnion = PendenteTurista | PendenteProfissional | PendenteEmpresa

export function useVerificacao(filtros: FiltrosVerificacao) {
  const { admin, getComunidade } = usePermissao()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pendentes, setPendentes] = useState<PendenteUnion[]>([])
  const [contadores, setContadores] = useState<ContadoresVerificacao>({
    turistas: 0,
    profissionais: 0,
    empresas: 0,
  })

  const fetchContadores = useCallback(async () => {
    const since = getPeriodoVerificacaoDate(filtros.periodo).toISOString()

    const [t, p, e] = await Promise.all([
      supabase.from('turistas').select('*', { count: 'exact', head: true }).eq('docs_verificado', false).gte('created_at', since),
      supabase.from('profissionais').select('*', { count: 'exact', head: true }).eq('docs_verificado', false).gte('created_at', since),
      supabase.from('empresas').select('*', { count: 'exact', head: true }).eq('docs_verificado', false).gte('created_at', since),
    ])
    if (t.error) throw t.error
    if (p.error) throw p.error
    if (e.error) throw e.error
    setContadores({
      turistas: t.count ?? 0,
      profissionais: p.count ?? 0,
      empresas: e.count ?? 0,
    })
  }, [filtros.periodo])

  const fetchTuristasPendentes = useCallback(async () => {
    const since = getPeriodoVerificacaoDate(filtros.periodo).toISOString()
    const search = normalizeBusca(filtros.busca)
    const query = supabase
      .from('turistas')
      .select('*')
      .eq('docs_verificado', false)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
    const { data, error } = await query
    if (error) throw error
    const mapped: PendenteTurista[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      usuario_id: String(r.usuario_id),
      nome_completo: String(r.nome_completo ?? ''),
      nome_usuario: String(r.nome_usuario ?? ''),
      foto_url: r.foto_perfil_url ? String(r.foto_perfil_url) : null,
      documento_frente_url: r.documento_frente_url ? String(r.documento_frente_url) : null,
      documento_verso_url: r.documento_verso_url ? String(r.documento_verso_url) : null,
      docs_verificado: Boolean(r.docs_verificado),
      docs_verificado_por: r.docs_verificado_por ? String(r.docs_verificado_por) : null,
      docs_verificado_em: r.docs_verificado_em ? String(r.docs_verificado_em) : null,
      created_at: String(r.created_at ?? new Date().toISOString()),
    }))
    setPendentes(
      mapped.filter((x) => {
        if (!search) return true
        return x.nome_completo.toLowerCase().includes(search) || x.nome_usuario.toLowerCase().includes(search)
      })
    )
  }, [filtros.busca, filtros.periodo])

  const fetchProfissionaisPendentes = useCallback(async () => {
    const since = getPeriodoVerificacaoDate(filtros.periodo).toISOString()
    const search = normalizeBusca(filtros.busca)
    const query = supabase
      .from('profissionais')
      .select('*')
      .eq('docs_verificado', false)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
    const { data, error } = await query
    if (error) throw error

    const comunidade = getComunidade()
    const mapped: PendenteProfissional[] = (data ?? []).map((r: Record<string, unknown>) => {
      const categorias = parseCategoriasProfissional(r.categorias)
      return {
        id: String(r.id),
        usuario_id: String(r.usuario_id),
        nome_completo: String(r.nome_completo ?? ''),
        nome_usuario: String(r.nome_usuario ?? ''),
        foto_url: r.foto_perfil_url ? String(r.foto_perfil_url) : null,
        categorias,
        placa_vermelha: Boolean(r.placa_vermelha),
        documentos: {
          identidade_url: String(r.identidade_url ?? ''),
          comprovante_residencia_url: String(r.comprovante_residencia_url ?? ''),
          comprovante_profissao_url: String(r.comprovante_profissao_url ?? ''),
        },
        docs_verificado: Boolean(r.docs_verificado),
        docs_verificado_por: r.docs_verificado_por ? String(r.docs_verificado_por) : null,
        docs_verificado_em: r.docs_verificado_em ? String(r.docs_verificado_em) : null,
        created_at: String(r.created_at ?? new Date().toISOString()),
      }
    })

    const filtered = mapped.filter((x) => {
      if (comunidade && !x.categorias.map((c) => c.toLowerCase()).includes(comunidade.toLowerCase())) return false
      if (filtros.categoria && filtros.categoria !== 'todas') {
        if (!x.categorias.map((c) => c.toLowerCase()).includes(filtros.categoria.toLowerCase())) return false
      }
      if (!search) return true
      return x.nome_completo.toLowerCase().includes(search) || x.nome_usuario.toLowerCase().includes(search)
    })
    setPendentes(filtered)
  }, [filtros.busca, filtros.categoria, filtros.periodo, getComunidade])

  const fetchEmpresasPendentes = useCallback(async () => {
    const since = getPeriodoVerificacaoDate(filtros.periodo).toISOString()
    const search = normalizeBusca(filtros.busca)
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('docs_verificado', false)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
    if (error) throw error
    const mapped: PendenteEmpresa[] = (data ?? []).map((r: Record<string, unknown>) => {
      const doc = r.documento_comercial_url ?? r.documento_url ?? r.documento_comercial
      return {
        id: String(r.id),
        usuario_id: String(r.usuario_id),
        nome_fantasia: String(r.nome_fantasia ?? ''),
        nome_usuario: String(r.nome_usuario ?? ''),
        categoria: String(r.categoria ?? ''),
        cidade: String(r.cidade ?? ''),
        documento_url: doc ? String(doc) : null,
        fotos_url: parseFotosEmpresa(r),
        docs_verificado: Boolean(r.docs_verificado),
        docs_verificado_por: r.docs_verificado_por ? String(r.docs_verificado_por) : null,
        docs_verificado_em: r.docs_verificado_em ? String(r.docs_verificado_em) : null,
        created_at: String(r.created_at ?? new Date().toISOString()),
      }
    })
    setPendentes(
      mapped.filter((x) => {
        if (!search) return true
        return x.nome_fantasia.toLowerCase().includes(search) || x.nome_usuario.toLowerCase().includes(search)
      })
    )
  }, [filtros.busca, filtros.periodo])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchContadores()
      if (filtros.perfil === 'turistas') await fetchTuristasPendentes()
      if (filtros.perfil === 'profissionais') await fetchProfissionaisPendentes()
      if (filtros.perfil === 'empresas') await fetchEmpresasPendentes()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar verificação'))
    } finally {
      setLoading(false)
    }
  }, [fetchContadores, fetchEmpresasPendentes, fetchProfissionaisPendentes, fetchTuristasPendentes, filtros.perfil])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const registrarLog = useCallback(
    async (tipo: PerfilVerificacao, perfilId: string, acao: string, detalhes?: Record<string, unknown>) => {
      if (!admin) return
      const raw = admin.admin_permissoes as unknown as { nivel?: number }
      const adminNivel = typeof raw?.nivel === 'number' ? raw.nivel : admin.admin_level
      await supabase.from('logs_verificacao').insert({
        tipo: tipo === 'turistas' ? 'turista' : tipo === 'profissionais' ? 'profissional' : 'empresa',
        perfil_id: perfilId,
        acao,
        admin_id: admin.id,
        admin_email: admin.email ?? admin.username ?? 'admin',
        admin_nivel: adminNivel,
        detalhes: detalhes ?? {},
      })
    },
    [admin]
  )

  const getTableByTipo = (tipo: PerfilVerificacao) =>
    tipo === 'turistas' ? 'turistas' : tipo === 'profissionais' ? 'profissionais' : 'empresas'

  const marcarDocsVerificado = useCallback(
    async (id: string, tipo: PerfilVerificacao) => {
      if (!admin) throw new Error('Admin não autenticado')
      const table = getTableByTipo(tipo)
      const { error } = await supabase
        .from(table)
        .update({
          docs_verificado: true,
          docs_verificado_por: admin.id,
          docs_verificado_em: new Date().toISOString(),
          verificado_por: admin.id,
          verificado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
      await fetchData()
    },
    [admin, fetchData]
  )

  const aprovar = useCallback(
    async (id: string, tipo: PerfilVerificacao) => {
      const table = getTableByTipo(tipo)
      const { data: perfil, error: perfilErr } = await supabase.from(table).select('usuario_id').eq('id', id).single()
      if (perfilErr) throw perfilErr
      const { error } = await supabase
        .from(table)
        .update({
          status: 'aprovado',
          aprovado_por: admin?.id ?? null,
          aprovado_em: new Date().toISOString(),
          motivo_reprovacao: null,
          prazo_reenvio_dias: null,
          reprovado_em: null,
          reprovado_por: null,
        })
        .eq('id', id)
      if (error) throw error
      if (perfil?.usuario_id) {
        await supabase.from('usuarios').update({ status: 'ativo' }).eq('id', perfil.usuario_id)
      }
      await fetchData()
    },
    [admin?.id, fetchData]
  )

  const reprovar = useCallback(
    async (id: string, tipo: PerfilVerificacao, motivo: string) => {
      if (!admin) throw new Error('Admin não autenticado')
      const table = getTableByTipo(tipo)
      const { data: perfil, error: perfilErr } = await supabase.from(table).select('usuario_id').eq('id', id).single()
      if (perfilErr) throw perfilErr
      const payload = {
        status: 'reprovado',
        motivo_reprovacao: motivo,
        prazo_reenvio_dias: 7,
        reprovado_em: new Date().toISOString(),
        reprovado_por: admin.id,
      }
      const { error } = await supabase.from(table).update(payload).eq('id', id)
      if (error) throw error
      if (perfil?.usuario_id) {
        await supabase.from('usuarios').update({ status: 'reprovado' }).eq('id', perfil.usuario_id)
      }
      await fetchData()
    },
    [admin, fetchData]
  )

  const aprovarLote = useCallback(
    async (ids: string[], tipo: PerfilVerificacao) => {
      const table = getTableByTipo(tipo)
      const { error } = await supabase
        .from(table)
        .update({ status: 'aprovado', aprovado_por: admin?.id ?? null, aprovado_em: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
      await registrarLog(tipo, ids[0] ?? 'lote', 'aprovado_lote', { ids })
      await fetchData()
    },
    [admin?.id, fetchData, registrarLog]
  )

  const solicitarAcessoDocumentos = useCallback(
    async (perfilTipo: PerfilVerificacao, perfilId: string, motivo: string) => {
      if (!admin) throw new Error('Admin não autenticado')
      const { error } = await supabase.rpc('solicitar_acesso_documentos', {
        p_solicitante_id: admin.id,
        p_perfil_tipo: perfilTipo === 'turistas' ? 'turista' : perfilTipo === 'profissionais' ? 'profissional' : 'empresa',
        p_perfil_id: perfilId,
        p_motivo: motivo,
      })
      if (error) throw error
    },
    [admin]
  )

  return { pendentes, contadores, loading, error, marcarDocsVerificado, aprovar, reprovar, aprovarLote, solicitarAcessoDocumentos, refetch: fetchData }
}

