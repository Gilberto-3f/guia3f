'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from './usePermissao'
import { notificarDecisaoDenuncia } from '@/lib/notificarDecisaoDenuncia'
import { adminContextFromGate, registrarLogVerificacao } from '../utils/registrarLogVerificacao'
import type { AplicarMedidaDenunciaParams, AplicarPenalidadeParams, Denuncia, DenunciasFiltros } from '../types/admin.types'

type DenunciaRow = {
  id: string
  denunciante_id: string
  denunciado_id: string
  denunciado_tipo: 'turista' | 'profissional' | 'empresa' | 'story'
  motivo: string
  descricao: string | null
  evidencias: unknown
  status: 'pendente' | 'em_investigacao' | 'encerrada' | 'arquivada'
  gravidade: 'leve' | 'media' | 'grave' | null
  responsavel_id: string | null
  analisado_em: string | null
  analisado_por: string | null
  penalidade_aplicada: 'advertencia' | 'suspensao' | 'banimento' | null
  penalidade_detalhes: { dias?: number; motivo?: string; prazo_reenvio?: number; medida?: string; texto?: string } | null
  conteudo_tipo?: string | null
  conteudo_id?: string | null
  denunciado_usuario_id?: string | null
  medida_aplicada?: boolean | null
  medida_tipo?: string | null
  created_at: string
  updated_at: string
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

function filtrosKey(f: DenunciasFiltros) {
  return `${f.perfil}|${f.status}|${f.busca.trim()}`
}

export function useDenuncias(filtros: DenunciasFiltros) {
  const { admin, nivel, getComunidade } = usePermissao()
  const filtrosRef = useRef(filtros)
  filtrosRef.current = filtros
  const filtrosStableKey = useMemo(
    () => filtrosKey(filtros),
    [filtros.perfil, filtros.status, filtros.busca]
  )
  const [denuncias, setDenuncias] = useState<Denuncia[]>([])
  const [contadores, setContadores] = useState({
    pendente: 0,
    em_investigacao: 0,
    encerrada: 0,
    arquivada: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  /** Evita skeleton a cada refetch quando só mudam nivel/admin (mesmos filtros). */
  const prevFiltrosKeyRef = useRef<string | null>(null)

  const resolveDenunciado = useCallback(async (tipo: 'turista' | 'profissional' | 'empresa' | 'story', alvoId: string) => {
    if (tipo === 'story') {
      const { data: sRow } = await supabase.from('stories').select('id, conteudo_url, autor_id').eq('id', alvoId).maybeSingle()
      const autorUid = sRow?.autor_id != null ? String(sRow.autor_id) : ''
      const { data: uRow } = autorUid
        ? await supabase.from('usuarios').select('email, username').eq('id', autorUid).maybeSingle()
        : { data: null }
      return {
        nome: 'Story',
        username: String(uRow?.username ?? uRow?.email ?? 'autor'),
        email: String(uRow?.email ?? ''),
        story_conteudo_url: sRow?.conteudo_url != null ? String(sRow.conteudo_url) : null,
        story_autor_usuario_id: autorUid || null,
      }
    }
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
    const f = filtrosRef.current
    if (f.perfil === 'auditoria') {
      const { data, error: e } = await supabase.from('denuncias').select('status').eq('status', 'arquivada')
      if (e) throw e
      setContadores({ pendente: 0, em_investigacao: 0, encerrada: 0, arquivada: (data ?? []).length })
      return
    }
    const tipo = f.perfil === 'turistas' ? 'turista' : f.perfil === 'profissionais' ? 'profissional' : 'empresa'
    const { data, error: e } = await supabase.from('denuncias').select('status').eq('denunciado_tipo', tipo).neq('status', 'arquivada')
    if (e) throw e
    const base = { pendente: 0, em_investigacao: 0, encerrada: 0, arquivada: 0 }
    for (const row of (data ?? []) as Array<{ status?: keyof typeof base }>) {
      const s = row.status
      if (s && s in base) base[s] += 1
    }
    setContadores(base)
  }, [filtros.perfil])

  const fetchDenuncias = useCallback(async (opt?: { skeleton?: boolean }) => {
    const f = filtrosRef.current
    const fk = filtrosKey(f)
    const autoSkeleton = prevFiltrosKeyRef.current === null || prevFiltrosKeyRef.current !== fk
    prevFiltrosKeyRef.current = fk
    const skeleton = opt?.skeleton === true ? true : opt?.skeleton === false ? false : autoSkeleton

    if (skeleton) setLoading(true)
    setError(null)
    try {
      const nivelNum = typeof nivel === 'string' ? parseInt(nivel, 10) : nivel

      if (f.perfil === 'auditoria') {
        setDenuncias([])
        setLoading(false)
        return
      }

      const tipo = f.perfil === 'turistas' ? 'turista' : f.perfil === 'profissionais' ? 'profissional' : 'empresa'
      let query = supabase
        .from('denuncias')
        .select(
          'id, denunciante_id, denunciado_id, denunciado_tipo, denunciado_usuario_id, conteudo_tipo, conteudo_id, motivo, descricao, evidencias, status, gravidade, responsavel_id, analisado_em, analisado_por, penalidade_aplicada, penalidade_detalhes, medida_aplicada, medida_tipo, created_at, updated_at',
        )
        .eq('denunciado_tipo', tipo)
        .neq('status', 'arquivada')
        .order('created_at', { ascending: false })

      if (f.status !== 'todas') query = query.eq('status', f.status)
      if (f.busca.trim()) query = query.or(`motivo.ilike.%${f.busca.trim()}%,descricao.ilike.%${f.busca.trim()}%`)

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      let rows = (data ?? []) as DenunciaRow[]

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

          const alvoStory = alvo as {
            nome: string
            username: string
            email: string
            story_conteudo_url?: string | null
            story_autor_usuario_id?: string | null
          }

          return {
            id: r.id,
            denunciante_id: r.denunciante_id,
            denunciante_email: String(denuncianteRes.data?.email ?? ''),
            denunciante_nome: String(denuncianteRes.data?.username ?? ''),
            denunciado_id: r.denunciado_id,
            denunciado_tipo: r.denunciado_tipo,
            denunciado_email: alvoStory.email,
            denunciado_nome: alvoStory.nome,
            denunciado_username: alvoStory.username,
            story_conteudo_url: alvoStory.story_conteudo_url ?? null,
            story_autor_usuario_id: alvoStory.story_autor_usuario_id ?? null,
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
            denunciado_usuario_id: r.denunciado_usuario_id ?? null,
            conteudo_tipo: (r.conteudo_tipo as Denuncia['conteudo_tipo']) ?? null,
            conteudo_id: r.conteudo_id ?? null,
            medida_aplicada: Boolean(r.medida_aplicada),
            medida_tipo: r.medida_tipo ?? null,
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
      if (skeleton) setLoading(false)
    }
  }, [fetchContadores, filtrosStableKey, getComunidade, nivel, resolveDenunciado])

  const applyAudit = useCallback(
    async (denunciaId: string, acao: string, statusFinal: string, detalhes: Record<string, unknown>) => {
      if (!admin) return
      await registrarLogVerificacao({
        tipo: 'denuncia',
        perfil_id: denunciaId,
        acao,
        status_final: statusFinal,
        admin: adminContextFromGate(admin),
        detalhes: { modulo: 'denuncias', ...detalhes },
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

      const { data: denRow } = await supabase
        .from('denuncias')
        .select('id, denunciante_id, denunciado_usuario_id, conteudo_tipo, motivo')
        .eq('id', denuncia_id)
        .maybeSingle()
      if (denRow) {
        const acaoNotif = acao === 'advertir' ? 'advertencia' : acao === 'suspender' ? 'suspensao' : 'banimento'
        await notificarDecisaoDenuncia(supabase, denRow, acaoNotif, {
          texto: motivo.trim(),
          dias: acao === 'suspender' ? suspensao_dias ?? 7 : undefined,
        })
      }

      const statusMap: Record<string, string> = {
        advertir: 'denuncia_advertencia',
        suspender: 'denuncia_suspensao',
        banir: 'denuncia_banimento',
      }
      await applyAudit(denuncia_id, `denuncia_${acao}`, statusMap[acao] ?? `denuncia_${acao}`, detalhes)
      await fetchDenuncias({ skeleton: false })
    },
    [admin, applyAudit, fetchDenuncias]
  )

  const marcarEmInvestigacao = useCallback(
    async (denuncia_id: string) => {
      if (!admin) throw new Error('Admin não autenticado')
      const { error: updateErr } = await supabase.from('denuncias').update({ status: 'em_investigacao', responsavel_id: admin.id }).eq('id', denuncia_id)
      if (updateErr) throw updateErr
      await applyAudit(denuncia_id, 'denuncia_em_investigacao', 'em_investigacao', {})
      await fetchDenuncias({ skeleton: false })
    },
    [admin, applyAudit, fetchDenuncias]
  )

  const aplicarMedida = useCallback(
    async ({ denuncia_id, medida, texto }: AplicarMedidaDenunciaParams) => {
      if (!admin) throw new Error('Admin não autenticado')

      const { data: den, error: loadErr } = await supabase.from('denuncias').select('*').eq('id', denuncia_id).single()
      if (loadErr || !den) throw loadErr ?? new Error('Denúncia não encontrada')

      const row = den as Record<string, unknown>
      const usuarioId = row.denunciado_usuario_id != null ? String(row.denunciado_usuario_id) : null
      const conteudoTipo = row.conteudo_tipo != null ? String(row.conteudo_tipo) : null
      const conteudoId = row.conteudo_id != null ? String(row.conteudo_id) : null

      if (medida === 'bloqueio' && usuarioId) {
        await supabase.from('usuarios').update({ status: 'suspenso' }).eq('id', usuarioId)
      }

      if (medida === 'excluir_conteudo') {
        const alvoId = conteudoId ?? (row.denunciado_tipo === 'story' ? String(row.denunciado_id) : null)
        const tipo = conteudoTipo ?? (row.denunciado_tipo === 'story' ? 'story' : null)
        if (alvoId && tipo === 'post') {
          await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', alvoId)
        } else if (alvoId && tipo === 'comentario') {
          await supabase.from('comentarios').update({ deleted_at: new Date().toISOString() }).eq('id', alvoId)
        } else if (alvoId && tipo === 'story') {
          await supabase.from('stories').delete().eq('id', alvoId)
        } else if (alvoId && tipo === 'avaliacao') {
          await supabase.from('avaliacoes').delete().eq('id', alvoId)
        }
      }

      if (medida === 'excluir_cadastro' && usuarioId) {
        await supabase.from('usuarios').update({ status: 'suspenso' }).eq('id', usuarioId)
      }

      const detalhes = { medida, texto: texto?.trim() ?? null }
      const { error: updateErr } = await supabase
        .from('denuncias')
        .update({
          medida_aplicada: true,
          medida_tipo: medida,
          status: 'em_investigacao',
          penalidade_detalhes: detalhes,
          responsavel_id: admin.id,
          analisado_por: admin.id,
          analisado_em: new Date().toISOString(),
        })
        .eq('id', denuncia_id)
      if (updateErr) throw updateErr

      await notificarDecisaoDenuncia(
        supabase,
        {
          id: denuncia_id,
          denunciante_id: String(row.denunciante_id ?? ''),
          denunciado_usuario_id: usuarioId,
          conteudo_tipo: conteudoTipo,
          motivo: row.motivo != null ? String(row.motivo) : null,
        },
        medida,
        { texto: texto?.trim() ?? null },
      )

      await applyAudit(denuncia_id, `denuncia_medida_${medida}`, medida, detalhes)
      await fetchDenuncias({ skeleton: false })
    },
    [admin, applyAudit, fetchDenuncias],
  )

  const arquivar = useCallback(
    async (denuncia_id: string, motivoArquivo?: string) => {
      if (!admin) throw new Error('Admin não autenticado')

      const { data: denRow } = await supabase
        .from('denuncias')
        .select('id, denunciante_id, denunciado_usuario_id, conteudo_tipo, motivo, medida_aplicada')
        .eq('id', denuncia_id)
        .maybeSingle()

      const payload = {
        status: 'arquivada',
        responsavel_id: admin.id,
        analisado_por: admin.id,
        analisado_em: new Date().toISOString(),
      }
      const { error: updateErr } = await supabase.from('denuncias').update(payload).eq('id', denuncia_id)
      if (updateErr) throw updateErr

      if (denRow && !denRow.medida_aplicada) {
        await notificarDecisaoDenuncia(supabase, denRow, 'arquivada', {
          texto: motivoArquivo?.trim() || null,
        })
      }

      await applyAudit(denuncia_id, 'denuncia_arquivada', 'arquivada', { admin_email: admin.email })
      await fetchDenuncias({ skeleton: false })
    },
    [admin, applyAudit, fetchDenuncias],
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
    aplicarMedida,
    marcarEmInvestigacao,
    arquivar,
    refetch: () => {
      void fetchDenuncias({ skeleton: true })
    },
  }
}
