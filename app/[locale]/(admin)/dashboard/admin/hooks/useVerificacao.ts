'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'
import type {
  ContadoresVerificacao,
  PendenteEmpresa,
  PendenteProfissional,
  PendenteTurista,
  PerfilVerificacao,
} from '../types/admin.types'
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

function urlsDocumentosDeRow(tipo: PerfilVerificacao, r: Record<string, unknown>): string[] {
  const out: string[] = []
  const push = (v: unknown) => {
    const s = String(v ?? '').trim()
    if (s) out.push(s)
  }
  if (tipo === 'turistas') {
    push(r.documento_frente_url)
    push(r.documento_verso_url)
    return out
  }
  if (tipo === 'profissionais') {
    const d = (r.documentos ?? {}) as Record<string, string>
    push(r.documento_frente_url)
    push(d.identidade_url)
    push(r.documento_verso_url)
    push(d.documento_verso_url)
    push(r.comprovante_residencia_url)
    push(d.comprovante_residencia_url)
    push(r.comprovante_profissao_url)
    push(d.comprovante_profissao_url)
    return out
  }
  push(r.documento_frente_url)
  push(r.documento_verso_url)
  push(r.comprovante_residencia_url)
  push(r.documento_comercial_url)
  push(r.documento_url)
  return out
}

function aquecerCacheDocumentos(tipo: PerfilVerificacao, rows: Record<string, unknown>[]) {
  const urls = [...new Set(rows.flatMap((r) => urlsDocumentosDeRow(tipo, r)))]
  if (urls.length) void resolverUrlsDocumentosStorageAdmin(urls)
}

export function useVerificacao(filtros: FiltrosVerificacao) {
  const { getComunidade } = usePermissao()
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
        .eq('status', 'aguardando_analise')
        .not('documentos_enviados_em', 'is', null),
      supabase
        .from('empresas')
        .select('*', { count: 'exact', head: true })
        .or('docs_verificado.eq.false,status.eq.aguardando_aprovacao'),
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
    aquecerCacheDocumentos('turistas', rows)
  }, [])

  const fetchProfissionaisPendentes = useCallback(async () => {
    const { data, error } = await supabase
      .from('profissionais')
      .select('*')
      .eq('status', 'aguardando_analise')
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
    aquecerCacheDocumentos('profissionais', rows)
  }, [getComunidade])

  const fetchEmpresasPendentes = useCallback(async () => {
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .or('docs_verificado.eq.false,status.eq.aguardando_aprovacao')
      .order('created_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as Record<string, unknown>[]
    const emailMap = await fetchEmailPorUsuarioIds(rows.map((r) => String(r.usuario_id ?? '')))
    const mapped: PendenteEmpresa[] = rows.map((r) => {
      const docRaw = r.documento_comercial_url ?? r.documento_url ?? r.documento_comercial
      const doc = docRaw ? String(docRaw) : ''
      const docComercial =
        r.documento_comercial_url != null && String(r.documento_comercial_url).trim()
          ? String(r.documento_comercial_url).trim()
          : null
      const uid = String(r.usuario_id ?? '')
      return {
        id: String(r.id),
        usuario_id: uid,
        nome_fantasia: String(r.nome_fantasia ?? ''),
        nome_usuario: String(r.nome_usuario ?? ''),
        categoria: String(r.categoria ?? ''),
        cidade: String(r.cidade ?? ''),
        documento_frente_url: r.documento_frente_url != null ? String(r.documento_frente_url) : null,
        documento_verso_url: r.documento_verso_url != null ? String(r.documento_verso_url) : null,
        comprovante_residencia_url: r.comprovante_residencia_url != null ? String(r.comprovante_residencia_url) : null,
        documento_url: doc || null,
        documento_comercial_url: docComercial,
        fotos_url: parseFotosEmpresa(r),
        docs_verificado: Boolean(r.docs_verificado),
        docs_verificado_por: r.docs_verificado_por ? String(r.docs_verificado_por) : null,
        docs_verificado_em: r.docs_verificado_em ? String(r.docs_verificado_em) : null,
        created_at: String(r.created_at ?? new Date().toISOString()),
        email: emailMap.get(uid) || null,
        telefone: r.telefone != null && String(r.telefone).trim() ? String(r.telefone).trim() : null,
        whatsapp: r.whatsapp != null && String(r.whatsapp).trim() ? String(r.whatsapp).trim() : null,
        status: r.status != null ? String(r.status) : null,
      }
    })
    setPendentes(mapped)
    aquecerCacheDocumentos('empresas', rows)
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

  const aprovar = useCallback(
    async (id: string, tipo: PerfilVerificacao) => {
      const res = await fetch('/api/admin/verificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acao: 'aprovar', tipo, id }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Não foi possível aprovar.')
      }
      await fetchData()
    },
    [fetchData]
  )

  const reprovar = useCallback(
    async (id: string, tipo: PerfilVerificacao, motivo: string) => {
      const res = await fetch('/api/admin/verificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acao: 'reprovar', tipo, id, motivo }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Não foi possível reprovar.')
      }
      await fetchData()
    },
    [fetchData]
  )

  return { pendentes, contadores, loading, error, aprovar, reprovar, refetch: fetchData }
}
