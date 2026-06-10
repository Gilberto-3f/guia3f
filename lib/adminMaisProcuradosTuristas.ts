import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizarSegmentoMercado,
  preencherContagensSegmento,
  type ContagemSegmento,
  type SegmentoMercado,
} from '@/lib/segmentosMercado'

export type MaisProcuradosTuristasDados = {
  visibilidade: ContagemSegmento[]
  engajamento: ContagemSegmento[]
}

type EmpresaRow = { id: string; usuario_id: string; categoria: string | null }

function bumpSegmento(map: Partial<Record<SegmentoMercado, number>>, segmento: SegmentoMercado | null, n = 1) {
  if (!segmento) return
  map[segmento] = (map[segmento] ?? 0) + n
}

async function idsTuristas(adminDb: SupabaseClient): Promise<string[]> {
  const { data, error } = await adminDb.from('turistas').select('usuario_id')
  if (error) throw error
  return (data ?? []).map((r) => String((r as { usuario_id: string }).usuario_id)).filter(Boolean)
}

async function mapasEmpresas(adminDb: SupabaseClient) {
  const { data, error } = await adminDb.from('empresas').select('id, usuario_id, categoria')
  if (error) throw error

  const empresaIdParaSegmento = new Map<string, SegmentoMercado>()
  const autorEmpresaParaSegmento = new Map<string, SegmentoMercado>()
  const autorIds: string[] = []

  for (const row of (data ?? []) as EmpresaRow[]) {
    const segmento = normalizarSegmentoMercado(row.categoria)
    if (!segmento) continue
    empresaIdParaSegmento.set(row.id, segmento)
    autorEmpresaParaSegmento.set(row.usuario_id, segmento)
    autorIds.push(row.usuario_id)
  }

  return { empresaIdParaSegmento, autorEmpresaParaSegmento, autorIds }
}

async function agregarVisibilidade(
  adminDb: SupabaseClient,
  turistaIds: string[],
  empresaIdParaSegmento: Map<string, SegmentoMercado>,
  desdeIso: string,
): Promise<Partial<Record<SegmentoMercado, number>>> {
  const parcial: Partial<Record<SegmentoMercado, number>> = {}
  if (turistaIds.length === 0) return parcial

  const [visitasPerfil, visitasLog] = await Promise.all([
    adminDb
      .from('perfil_visitas')
      .select('empresa_id')
      .eq('tipo_alvo', 'empresa')
      .in('visitante_usuario_id', turistaIds)
      .gte('visitado_em', desdeIso),
    adminDb
      .from('log_visita')
      .select('empresa_id')
      .in('usuario_id', turistaIds)
      .gte('created_at', desdeIso),
  ])

  if (visitasPerfil.error) throw visitasPerfil.error
  if (visitasLog.error) throw visitasLog.error

  for (const row of visitasPerfil.data ?? []) {
    const empresaId = String((row as { empresa_id: string }).empresa_id ?? '')
    bumpSegmento(parcial, empresaIdParaSegmento.get(empresaId) ?? null)
  }
  for (const row of visitasLog.data ?? []) {
    const empresaId = String((row as { empresa_id: string }).empresa_id ?? '')
    bumpSegmento(parcial, empresaIdParaSegmento.get(empresaId) ?? null)
  }

  return parcial
}

async function mapaPostParaSegmento(
  adminDb: SupabaseClient,
  autorEmpresaParaSegmento: Map<string, SegmentoMercado>,
  autorIds: string[],
): Promise<Map<string, SegmentoMercado>> {
  const map = new Map<string, SegmentoMercado>()
  if (autorIds.length === 0) return map

  const { data, error } = await adminDb.from('posts').select('id, autor_id').in('autor_id', autorIds).is('deleted_at', null)
  if (error) throw error

  for (const row of data ?? []) {
    const r = row as { id: string; autor_id: string }
    const segmento = autorEmpresaParaSegmento.get(r.autor_id)
    if (segmento) map.set(r.id, segmento)
  }

  return map
}

function agregarPorPost(
  parcial: Partial<Record<SegmentoMercado, number>>,
  postParaSegmento: Map<string, SegmentoMercado>,
  rows: { post_id?: string | null }[],
) {
  for (const row of rows) {
    const postId = row.post_id
    if (!postId) continue
    bumpSegmento(parcial, postParaSegmento.get(postId) ?? null)
  }
}

async function agregarEngajamento(
  adminDb: SupabaseClient,
  turistaIds: string[],
  empresaIdParaSegmento: Map<string, SegmentoMercado>,
  autorEmpresaParaSegmento: Map<string, SegmentoMercado>,
  autorIds: string[],
  desdeIso: string,
): Promise<Partial<Record<SegmentoMercado, number>>> {
  const parcial: Partial<Record<SegmentoMercado, number>> = {}
  if (turistaIds.length === 0) return parcial

  const postParaSegmento = await mapaPostParaSegmento(adminDb, autorEmpresaParaSegmento, autorIds)
  const postIds = [...postParaSegmento.keys()]

  const [avaliacoes, curtidas, comentarios, salvos, reposts] = await Promise.all([
    adminDb
      .from('avaliacoes')
      .select('empresa_id')
      .in('usuario_id', turistaIds)
      .gte('created_at', desdeIso),
    postIds.length > 0
      ? adminDb
          .from('curtidas')
          .select('post_id')
          .in('usuario_id', turistaIds)
          .in('post_id', postIds)
          .gte('created_at', desdeIso)
      : Promise.resolve({ data: [], error: null }),
    postIds.length > 0
      ? adminDb
          .from('comentarios')
          .select('post_id')
          .in('autor_id', turistaIds)
          .in('post_id', postIds)
          .gte('created_at', desdeIso)
      : Promise.resolve({ data: [], error: null }),
    postIds.length > 0
      ? adminDb
          .from('item_salvo')
          .select('post_id')
          .in('usuario_id', turistaIds)
          .in('post_id', postIds)
          .gte('salvo_em', desdeIso)
      : Promise.resolve({ data: [], error: null }),
    postIds.length > 0
      ? adminDb
          .from('posts')
          .select('post_original_id')
          .in('autor_id', turistaIds)
          .in('post_original_id', postIds)
          .is('deleted_at', null)
          .gte('created_at', desdeIso)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (avaliacoes.error) throw avaliacoes.error
  if (curtidas.error) throw curtidas.error
  if (comentarios.error) throw comentarios.error
  if (salvos.error) throw salvos.error
  if (reposts.error) throw reposts.error

  for (const row of avaliacoes.data ?? []) {
    const empresaId = String((row as { empresa_id: string }).empresa_id ?? '')
    bumpSegmento(parcial, empresaIdParaSegmento.get(empresaId) ?? null)
  }

  agregarPorPost(parcial, postParaSegmento, (curtidas.data ?? []) as { post_id?: string | null }[])
  agregarPorPost(parcial, postParaSegmento, (comentarios.data ?? []) as { post_id?: string | null }[])
  agregarPorPost(parcial, postParaSegmento, (salvos.data ?? []) as { post_id?: string | null }[])

  for (const row of reposts.data ?? []) {
    const origId = (row as { post_original_id: string }).post_original_id
    bumpSegmento(parcial, postParaSegmento.get(origId) ?? null)
  }

  return parcial
}

export async function buscarMaisProcuradosTuristas(
  adminDb: SupabaseClient,
  desde: Date,
): Promise<MaisProcuradosTuristasDados> {
  const desdeIso = desde.toISOString()
  const [turistaIds, { empresaIdParaSegmento, autorEmpresaParaSegmento, autorIds }] = await Promise.all([
    idsTuristas(adminDb),
    mapasEmpresas(adminDb),
  ])

  const [visibilidadeParcial, engajamentoParcial] = await Promise.all([
    agregarVisibilidade(adminDb, turistaIds, empresaIdParaSegmento, desdeIso),
    agregarEngajamento(
      adminDb,
      turistaIds,
      empresaIdParaSegmento,
      autorEmpresaParaSegmento,
      autorIds,
      desdeIso,
    ),
  ])

  return {
    visibilidade: preencherContagensSegmento(visibilidadeParcial),
    engajamento: preencherContagensSegmento(engajamentoParcial),
  }
}
