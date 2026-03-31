'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from './usePermissao'
import type { AplicarPenalidadeParams, Denuncia, DenunciasFiltros } from '../types/admin.types'

type DenunciaRow = {
  id: string
  denunciante_id: string
  denunciado_id: string
  denunciado_tipo: 'turista' | 'profissional' | 'empresa'
  motivo: string
  descricao: string | null
  evidencias: unknown
  status: 'pendente' | 'em_investigacao' | 'encerrada' | 'arquivada'
  gravidade: 'leve' | 'media' | 'grave' | null
  responsavel_id: string | null
  analisado_em: string | null
  analisado_por: string | null
  penalidade_aplicada: 'advertencia' | 'suspensao' | 'banimento' | null
  penalidade_detalhes: { dias?: number; motivo?: string; prazo_reenvio?: number } | null
  created_at: string
  updated_at: string
}

function getDataLimite(periodo: 'hoje' | '7d' | '30d'): string {
  const now = new Date()
  if (periodo === 'hoje') {
    now.setHours(0, 0, 0, 0)
    return now.toISOString()
  }
  if (periodo === '7d') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
}

function addBusinessDays(start: string, days: number): string {
  const d = new Date(start)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const weekday = d.getDay()
    if (weekday !== 0 && weekday !== 6) added += 1
  }
  return d.toISOString()
}

export function useDenuncias(filtros: DenunciasFiltros) {
  const { admin, nivel, getComunidade } = usePermissao()
  const [denuncias, setDenuncias] = useState<Denuncia[]>([])
  const [contadores, setContadores] = useState({
    pendente: 0,
    em_investigacao: 0,
    encerrada: 0,
    arquivada: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const resolveDenunciado = useCallback(async (tipo: 'turista' | 'profissional' | 'empresa', alvoId: string) => {
    if (tipo === 'turista') {
      const { data: row } = await supabase.from('turistas').select('nome_completo, nome_usuario, usuario_id').eq('id', alvoId).maybeSingle()
      const { data: user } = row?.usuario_id ? await supabase.from('usuarios').select('email').eq('id', row.usuario_id).maybeSingle() : { data: null }
      return { nome: String(row?.nome_completo ?? ''), username: String(row?.nome_usuario ?? ''), email: String(user?.email ?? '') }
    }
    if (tipo === 'profissional') {
      const { data: row } = await supabase.from('profissionais').select('nome_completo, nome_usuario, usuario_id, categorias').eq('id', alvoId).maybeSingle()
      const { data: user } = row?.usuario_id ? await supabase.from('usuarios').select('email').eq('id', row.usuario_id).maybeSingle() : { data: null }
      return {
        nome: String(row?.nome_completo ?? ''),
        username: String(row?.nome_usuario ?? ''),
        email: String(user?.email ?? ''),
        categorias: Array.isArray((row as { categorias?: unknown[] } | null)?.categorias)
          ? ((row as { categorias?: unknown[] }).categorias ?? []).map((c) => String(c).toLowerCase())
          : [],
      }
    }
    const { data: row } = await supabase.from('empresas').select('nome_fantasia, nome_usuario, usuario_id').eq('id', alvoId).maybeSingle()
    const { data: user } = row?.usuario_id ? await supabase.from('usuarios').select('email').eq('id', row.usuario_id).maybeSingle() : { data: null }
    return { nome: String(row?.nome_fantasia ?? ''), username: String(row?.nome_usuario ?? ''), email: String(user?.email ?? '') }
  }, [])

  const fetchContadores = useCallback(async () => {
    const tipo = filtros.perfil === 'turistas' ? 'turista' : filtros.perfil === 'profissionais' ? 'profissional' : 'empresa'
    const { data, error: e } = await supabase.from('denuncias').select('status').eq('denunciado_tipo', tipo)
    if (e) throw e
    const base = { pendente: 0, em_investigacao: 0, encerrada: 0, arquivada: 0 }
    for (const row of (data ?? []) as Array<{ status?: keyof typeof base }>) {
      const s = row.status
      if (s && s in base) base[s] += 1
    }
    setContadores(base)
  }, [filtros.perfil])

  const fetchDenuncias = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 🔧 CONVERSÃO DE nivel PARA NÚMERO
      const nivelNum = typeof nivel === 'string' ? parseInt(nivel, 10) : nivel

      const tipo = filtros.perfil === 'turistas' ? 'turista' : filtros.perfil === 'profissionais' ? 'profissional' : 'empresa'
      let query = supabase
        .from('denuncias')
        .select('id, denunciante_id, denunciado_id, denunciado_tipo, motivo, descricao, evidencias, status, gravidade, responsavel_id, analisado_em, analisado_por, penalidade_aplicada, penalidade_detalhes, created_at, updated_at')
        .eq('denunciado_tipo', tipo)
        .gte('created_at', getDataLimite(filtros.periodo))
        .order('created_at', { ascending: false })

      if (filtros.status !== 'todas') query = query.eq('status', filtros.status)
      if (filtros.busca.trim()) query = query.or(`motivo.ilike.%${filtros.busca.trim()}%,descricao.ilike.%${filtros.busca.trim()}%`)

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      let rows = (data ?? []) as DenunciaRow[]

      // 🔧 USAR nivelNum AQUI
      if (tipo === 'profissional' && nivelNum === 2) {
        const comunidade = String(getComunidade() ?? '').toLowerCase()
        if (comunidade) {
          const allowedIds = new Set<string>()
          const { data: profs } = await supabase.from('profissionais').select('id, categorias')
          for (const p of (profs ?? []) as Array<{ id: string; categorias?: unknown[] }>) {
            const categorias = Array.isArray(p.categorias) ? p.categorias.map((c) => String(c).toLowerCase()) : []
            if (categorias.includes(comunidade)) allowedIds.add(p.id)
          }
          rows = rows.filter((r) => allowedIds.has(r.denunciado_id))
        }
      }

      const mapped = await Promise.all(
        rows.map(async (r) => {
          const [denuncianteRes, alvo, responsavelRes] = await Promise.all([
            supabase.from('usuarios').select('email, username').eq('id', r.denunciante_id).maybeSingle(),
            resolveDenunciado(r.denunciado_tipo, r.denunciado_id),
            r.responsavel_id ? supabase.from('usuarios').select('email').eq('id', r.responsavel_id).maybeSingle() : Promise.resolve({ data: null }),
          ])

          const evidencias = Array.isArray(r.evidencias) ? r.evidencias.map((e) => String(e)) : []
          const prazo = r.status === 'em_investigacao' ? addBusinessDays(r.created_at, 3) : null
          const prazoEstourado = Boolean(prazo && new Date(prazo) < new Date())

          return {
            id: r.id,
            denunciante_id: r.denunciante_id,
            denunciante_email: String(denuncianteRes.data?.email ?? ''),
            denunciante_nome: String(denuncianteRes.data?.username ?? ''),
            denunciado_id: r.denunciado_id,
            denunciado_tipo: r.denunciado_tipo,
            denunciado_email: alvo.email,
            denunciado_nome: alvo.nome,
            denunciado_username: alvo.username,
            motivo: r.motivo,
            descricao: r.descricao,
            evidencias,
            status: r.status,
            gravidade: r.gravidade,
            responsavel_id: r.responsavel_id,
            responsavel_email: String(responsavelRes.data?.email ?? ''),
            analisado_em: r.analisado_em,
            analisado_por: r.analisado_por,
            penalidade_aplicada: r.penalidade_aplicada,
            penalidade_detalhes: r.penalidade_detalhes,
            prazo_analise_ate: prazo,
            prazo_estourado: prazoEstourado,
            created_at: r.created_at,
            updated_at: r.updated_at,
          } satisfies Denuncia
        })
      )

      const byUser = new Map<string, number>()
      for (const d of mapped) byUser.set(`${d.denunciado_tipo}:${d.denunciado_id}`, (byUser.get(`${d.denunciado_tipo}:${d.denunciado_id}`) ?? 0) + 1)
      setDenuncias(mapped.map((d) => ({ ...d, total_denuncias_anteriores: Math.max((byUser.get(`${d.denunciado_tipo}:${d.denunciado_id}`) ?? 1) - 1, 0) })))
      await fetchContadores()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar denúncias'))
    } finally {
      setLoading(false)
    }
  }, [fetchContadores, filtros.busca, filtros.perfil, filtros.periodo, filtros.status, getComunidade, nivel, resolveDenunciado])

  const applyAudit = useCallback(
    async (denunciaId: string, acao: string, detalhes: Record<string, unknown>) => {
      if (!admin) return
      await supabase.from('logs_verificacao').insert({
        tipo: 'denuncia',
        perfil_id: denunciaId,
        acao,
        admin_id: admin.id,
        admin_email: admin.email ?? admin.username ?? 'admin',
        admin_nivel: admin.admin_level,
        detalhes,
      })
    },
    [admin]
  )

  const aplicarPenalidade = useCallback(
    async ({ denuncia_id, acao, suspensao_dias, motivo }: AplicarPenalidadeParams) => {
      if (!admin) throw new Error('Admin não autenticado')
      if (!motivo.trim()) throw new Error('Motivo obrigatório')
      const penalidade = acao === 'advertir' ? 'advertencia' : acao === 'suspender' ? 'suspensao' : 'banimento'
      const detalhes = {
        motivo: motivo.trim(),
        dias: acao === 'suspender' ? suspensao_dias ?? 7 : undefined,
      }
      const { error: updateErr } = await supabase
        .from('denuncias')
        .update({
          status: 'encerrada',
          penalidade_aplicada: penalidade,
          penalidade_detalhes: detalhes,
          responsavel_id: admin.id,
          analisado_por: admin.id,
          analisado_em: new Date().toISOString(),
        })
        .eq('id', denuncia_id)
      if (updateErr) throw updateErr
      await applyAudit(denuncia_id, `denuncia_${acao}`, detalhes)
      await fetchDenuncias()
    },
    [admin, applyAudit, fetchDenuncias]
  )

  const marcarEmInvestigacao = useCallback(
    async (denuncia_id: string) => {
      if (!admin) throw new Error('Admin não autenticado')
      const { error: updateErr } = await supabase.from('denuncias').update({ status: 'em_investigacao', responsavel_id: admin.id }).eq('id', denuncia_id)
      if (updateErr) throw updateErr
      await applyAudit(denuncia_id, 'denuncia_em_investigacao', {})
      await fetchDenuncias()
    },
    [admin, applyAudit, fetchDenuncias]
  )

  const arquivar = useCallback(
    async (denuncia_id: string, motivo: string) => {
      if (!admin) throw new Error('Admin não autenticado')
      if (!motivo.trim()) throw new Error('Motivo obrigatório')
      const payload = {
        status: 'arquivada',
        penalidade_detalhes: { motivo: motivo.trim() },
        responsavel_id: admin.id,
        analisado_por: admin.id,
        analisado_em: new Date().toISOString(),
      }
      const { error: updateErr } = await supabase.from('denuncias').update(payload).eq('id', denuncia_id)
      if (updateErr) throw updateErr
      await applyAudit(denuncia_id, 'denuncia_arquivada', { motivo: motivo.trim() })
      await fetchDenuncias()
    },
    [admin, applyAudit, fetchDenuncias]
  )

  useEffect(() => {
    void fetchDenuncias()
  }, [fetchDenuncias])

  return {
    denuncias,
    contadores,
    loading,
    error,
    aplicarPenalidade,
    marcarEmInvestigacao,
    arquivar,
    refetch: fetchDenuncias,
  }
}
    // ... resto do código (igual)