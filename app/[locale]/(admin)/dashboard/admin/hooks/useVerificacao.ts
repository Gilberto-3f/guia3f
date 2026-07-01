'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolverUrlsDocumentosStorageAdmin } from '@/lib/documentosStorageUrl'
import type {
  ContadoresExclusaoCadastro,
  ContadoresVerificacao,
  PendenteEmpresa,
  PendenteProfissional,
  PendenteTurista,
  PerfilVerificacao,
} from '../types/admin.types'
import { usePermissao } from './usePermissao'
import { normalizarPaisProfissional } from '@/lib/adminConvites'

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
  const { getComunidade, getPais } = usePermissao()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pendentes, setPendentes] = useState<PendenteUnion[]>([])
  const [contadores, setContadores] = useState<ContadoresVerificacao>({
    turistas: 0,
    profissionais: 0,
    empresas: 0,
  })
  const [contadoresExclusao, setContadoresExclusao] = useState<ContadoresExclusaoCadastro>({
    turistas: 0,
    profissionais: 0,
    empresas: 0,
  })

  const fetchContadoresExclusao = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('solicitacoes_exclusao_cadastro')
        .select('tipo')
        .eq('status', 'pendente')
      if (error) {
        if (
          error.code === 'PGRST205' ||
          error.code === '42P01' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('schema cache')
        ) {
          setContadoresExclusao({ turistas: 0, profissionais: 0, empresas: 0 })
          return
        }
        throw error
      }
      const counts: ContadoresExclusaoCadastro = { turistas: 0, profissionais: 0, empresas: 0 }
      for (const row of data ?? []) {
        const tipo = String((row as { tipo?: string }).tipo ?? '') as keyof ContadoresExclusaoCadastro
        if (tipo in counts) counts[tipo] += 1
      }
      setContadoresExclusao(counts)
    } catch {
      setContadoresExclusao({ turistas: 0, profissionais: 0, empresas: 0 })
    }
  }, [])

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
        .eq('docs_verificado', false)
        .neq('status', 'aprovado')
        .or('documentos_enviados_em.not.is.null,documento_comercial_url.not.is.null'),
    ])
    if (t.error) throw t.error
    if (p.error) throw p.error
    if (e.error) throw e.error
    setContadores({
      turistas: t.count ?? 0,
      profissionais: p.count ?? 0,
      empresas: e.count ?? 0,
    })
    await fetchContadoresExclusao()
  }, [fetchContadoresExclusao])

  const fetchTuristasPendentes = useCallback(async () => {
    const { data, error } = await supabase
      .from('turistas')
      .select('*')
      .eq('docs_verificado', false)
      .order('created_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as Record<string, unknown>[]
    const uids = rows.map((r) => String(r.usuario_id ?? '')).filter(Boolean)
    const prePorTurista = new Map<string, Record<string, unknown>[]>()
    if (uids.length > 0) {
      const { data: preRows } = await supabase
        .from('turista_pre_liberacoes')
        .select('*')
        .in('turista_usuario_id', uids)
        .order('solicitado_em', { ascending: false })
      for (const pr of preRows ?? []) {
        const uid = String((pr as Record<string, unknown>).turista_usuario_id ?? '')
        if (!uid) continue
        const arr = prePorTurista.get(uid) ?? []
        arr.push(pr as Record<string, unknown>)
        prePorTurista.set(uid, arr)
      }
    }
    const emailMap = await fetchEmailPorUsuarioIds(uids)
    const mapped: PendenteTurista[] = rows.map((r) => ({
      id: String(r.id),
      usuario_id: String(r.usuario_id),
      nome_completo: String(r.nome_completo ?? ''),
      nome_usuario: String(r.nome_usuario ?? ''),
      foto_url: r.foto_perfil_url ? String(r.foto_perfil_url) : null,
      documento_frente_url: r.documento_frente_url ? String(r.documento_frente_url) : null,
      documento_verso_url: r.documento_verso_url ? String(r.documento_verso_url) : null,
      documento_identidade:
        r.documento_identidade != null && String(r.documento_identidade).trim()
          ? String(r.documento_identidade).trim()
          : null,
      docs_verificado: Boolean(r.docs_verificado),
      docs_verificado_por: r.docs_verificado_por ? String(r.docs_verificado_por) : null,
      docs_verificado_em: r.docs_verificado_em ? String(r.docs_verificado_em) : null,
      created_at: String(r.created_at ?? new Date().toISOString()),
      email: emailMap.get(String(r.usuario_id)) || null,
      whatsapp: r.whatsapp != null && String(r.whatsapp).trim() ? String(r.whatsapp).trim() : null,
      telefone: r.telefone != null && String(r.telefone).trim() ? String(r.telefone).trim() : null,
      pre_liberacoes: prePorTurista.get(String(r.usuario_id ?? '')) ?? [],
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
    const paisModerador = getPais()

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
        documento_identidade:
          r.documento_identidade != null && String(r.documento_identidade).trim()
            ? String(r.documento_identidade).trim()
            : null,
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
        pais: r.pais != null && String(r.pais).trim() ? String(r.pais).trim() : null,
        cidade_atuacao: Array.isArray(r.cidade_atuacao)
          ? r.cidade_atuacao.map((v) => String(v))
          : r.cidade_atuacao != null && String(r.cidade_atuacao).trim()
            ? [String(r.cidade_atuacao).trim()]
            : null,
      }
    })

    const filtered = mapped.filter((x) => {
      const cats = x.categorias ?? []
      if (comunidade && !cats.map((c) => c.toLowerCase()).includes(comunidade.toLowerCase())) return false
      if (paisModerador) {
        const p = normalizarPaisProfissional(x.pais)
        if (p && p !== paisModerador) return false
      }
      return true
    })
    setPendentes(filtered)
    aquecerCacheDocumentos('profissionais', rows)
  }, [getComunidade, getPais])

  const fetchEmpresasPendentes = useCallback(async () => {
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('docs_verificado', false)
      .neq('status', 'aprovado')
      .or('documentos_enviados_em.not.is.null,documento_comercial_url.not.is.null')
      .order('documentos_enviados_em', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []).filter(
      (r) => !Boolean((r as Record<string, unknown>).somente_modo_apresentacao),
    ) as Record<string, unknown>[]
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
        documento_fiscal:
          r.documento_fiscal != null && String(r.documento_fiscal).trim()
            ? String(r.documento_fiscal).trim()
            : null,
      }
    })
    setPendentes(mapped)
    aquecerCacheDocumentos('empresas', rows)
  }, [])

  /** Limpa lista antes da pintura ao trocar subaba — evita mapear linhas do perfil anterior. */
  useLayoutEffect(() => {
    setPendentes([])
    setLoading(true)
  }, [filtros.perfil])

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

  const solicitarExclusao = useCallback(
    async (id: string, tipo: PerfilVerificacao, motivo: string) => {
      const res = await fetch('/api/admin/verificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acao: 'solicitar_exclusao', tipo, id, motivo }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Não foi possível solicitar exclusão.')
      }
      await fetchData()
    },
    [fetchData],
  )

  return {
    pendentes,
    contadores,
    contadoresExclusao,
    loading,
    error,
    aprovar,
    reprovar,
    solicitarExclusao,
    refetch: fetchData,
  }
}
