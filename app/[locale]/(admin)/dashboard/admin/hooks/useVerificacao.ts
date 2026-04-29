'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  ContadoresVerificacao,
  PendenteEmpresa,
  PendenteProfissional,
  PendenteTurista,
  PerfilVerificacao,
} from '../types/admin.types'
import { usePermissao } from './usePermissao'
import { proximaRevisaoDepoisDeAprovacao } from '@/lib/verificacao-documentos'

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

async function fetchEmailPorUsuarioIds(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
  const map = new Map<string, string>()
  if (!unique.length) return map
  const { data, error } = await supabase.from('usuarios').select('id,email').in('id', unique)
  if (error) throw error
  for (const row of data ?? []) {
    const rec = row as { id?: string; email?: string | null }
    if (rec.id) map.set(String(rec.id), String(rec.email ?? '').trim())
  }
  return map
}

export type FiltrosVerificacao = {
  perfil: PerfilVerificacao
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
    const [t, p, e] = await Promise.all([
      supabase.from('turistas').select('*', { count: 'exact', head: true }).eq('docs_verificado', false),
      supabase
        .from('profissionais')
        .select('*', { count: 'exact', head: true })
        .eq('docs_verificado', false)
        .not('documentos_enviados_em', 'is', null),
      supabase.from('empresas').select('*', { count: 'exact', head: true }).eq('docs_verificado', false),
    ])
    if (t.error) throw t.error
    if (p.error) throw p.error
    if (e.error) throw e.error
    setContadores({
      turistas: t.count ?? 0,
      profissionais: p.count ?? 0,
      empresas: e.count ?? 0,
    })
  }, [])

  const fetchTuristasPendentes = useCallback(async () => {
    const { data, error } = await supabase
      .from('turistas')
      .select('*')
      .eq('docs_verificado', false)
      .order('created_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as Record<string, unknown>[]
    const emailMap = await fetchEmailPorUsuarioIds(rows.map((r) => String(r.usuario_id ?? '')))
    const mapped: PendenteTurista[] = rows.map((r) => ({
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
      email: emailMap.get(String(r.usuario_id)) || null,
    }))
    setPendentes(mapped)
  }, [])

  const fetchProfissionaisPendentes = useCallback(async () => {
    const { data, error } = await supabase
      .from('profissionais')
      .select('*')
      .eq('docs_verificado', false)
      .not('documentos_enviados_em', 'is', null)
      .order('documentos_enviados_em', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as Record<string, unknown>[]
    const emailMap = await fetchEmailPorUsuarioIds(rows.map((r) => String(r.usuario_id ?? '')))
    const comunidade = getComunidade()

    const mapped: PendenteProfissional[] = rows.map((r) => {
      const categorias = parseCategoriasProfissional(r.categorias)
      const uid = String(r.usuario_id ?? '')
      const w = r.whatsapp != null && String(r.whatsapp).trim() ? String(r.whatsapp).trim() : null
      const tel = r.telefone != null && String(r.telefone).trim() ? String(r.telefone).trim() : null
      return {
        id: String(r.id),
        usuario_id: uid,
        nome_completo: String(r.nome_completo ?? ''),
        nome_usuario: String(r.nome_usuario ?? ''),
        foto_url: r.foto_perfil_url ? String(r.foto_perfil_url) : null,
        categorias,
        placa_vermelha: Boolean(r.placa_vermelha),
        documento_frente_url: r.documento_frente_url != null ? String(r.documento_frente_url) : null,
        documentos: {
          identidade_url: String(r.documento_frente_url ?? r.identidade_url ?? ''),
          documento_verso_url: String(r.documento_verso_url ?? ''),
          comprovante_residencia_url: String(r.comprovante_residencia_url ?? ''),
          comprovante_profissao_url: String(r.comprovante_profissao_url ?? ''),
        },
        docs_verificado: Boolean(r.docs_verificado),
        docs_verificado_por: r.docs_verificado_por ? String(r.docs_verificado_por) : null,
        docs_verificado_em: r.docs_verificado_em ? String(r.docs_verificado_em) : null,
        created_at: String(r.created_at ?? new Date().toISOString()),
        email: emailMap.get(uid) || null,
        whatsapp: w,
        telefone: tel,
      }
    })

    const filtered = mapped.filter((x) => {
      const cats = x.categorias ?? []
      if (comunidade && !cats.map((c) => c.toLowerCase()).includes(comunidade.toLowerCase())) return false
      return true
    })
    setPendentes(filtered)
  }, [getComunidade])

  const fetchEmpresasPendentes = useCallback(async () => {
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('docs_verificado', false)
      .order('created_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as Record<string, unknown>[]
    const emailMap = await fetchEmailPorUsuarioIds(rows.map((r) => String(r.usuario_id ?? '')))
    const mapped: PendenteEmpresa[] = rows.map((r) => {
      const docRaw = r.documento_comercial_url ?? r.documento_url ?? r.documento_comercial
      const doc = docRaw ? String(docRaw) : ''
      const uid = String(r.usuario_id ?? '')
      return {
        id: String(r.id),
        usuario_id: uid,
        nome_fantasia: String(r.nome_fantasia ?? ''),
        nome_usuario: String(r.nome_usuario ?? ''),
        categoria: String(r.categoria ?? ''),
        cidade: String(r.cidade ?? ''),
        documento_url: doc || null,
        fotos_url: parseFotosEmpresa(r),
        docs_verificado: Boolean(r.docs_verificado),
        docs_verificado_por: r.docs_verificado_por ? String(r.docs_verificado_por) : null,
        docs_verificado_em: r.docs_verificado_em ? String(r.docs_verificado_em) : null,
        created_at: String(r.created_at ?? new Date().toISOString()),
        email: emailMap.get(uid) || null,
        telefone: r.telefone != null && String(r.telefone).trim() ? String(r.telefone).trim() : null,
        whatsapp: r.whatsapp != null && String(r.whatsapp).trim() ? String(r.whatsapp).trim() : null,
      }
    })
    setPendentes(mapped)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPendentes([])
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

  const getTableByTipo = (tipo: PerfilVerificacao) =>
    tipo === 'turistas' ? 'turistas' : tipo === 'profissionais' ? 'profissionais' : 'empresas'

  const marcarDocsVerificado = useCallback(
    async (id: string, tipo: PerfilVerificacao) => {
      if (!admin) throw new Error('Admin não autenticado')
      const table = getTableByTipo(tipo)
      const nowIso = new Date().toISOString()
      const extraProf =
        tipo === 'profissionais'
          ? {
              ultima_revisao_docs_em: nowIso,
              proxima_revisao_docs_em: proximaRevisaoDepoisDeAprovacao(),
            }
          : {}
      const { error } = await supabase
        .from(table)
        .update({
          docs_verificado: true,
          docs_verificado_por: admin.id,
          docs_verificado_em: nowIso,
          verificado_por: admin.id,
          verificado_em: nowIso,
          ...extraProf,
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
      const nowIso = new Date().toISOString()
      const extraProf =
        tipo === 'profissionais'
          ? {
              docs_verificado: true,
              docs_verificado_por: admin?.id ?? null,
              docs_verificado_em: nowIso,
              ultima_revisao_docs_em: nowIso,
              proxima_revisao_docs_em: proximaRevisaoDepoisDeAprovacao(),
            }
          : {}
      const { error } = await supabase
        .from(table)
        .update({
          status: 'aprovado',
          aprovado_por: admin?.id ?? null,
          aprovado_em: nowIso,
          motivo_reprovacao: null,
          prazo_reenvio_dias: null,
          reprovado_em: null,
          reprovado_por: null,
          ...extraProf,
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

  return { pendentes, contadores, loading, error, marcarDocsVerificado, aprovar, reprovar, refetch: fetchData }
}
