import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

type PerfilAtivos = 'turistas' | 'profissionais'

const CORES_ATIVOS_FAIXA = ['#0097b2', '#00D443', '#F1C40F']

function isAdminRole(role: string, nivel: number): boolean {
  return role === 'admin' || nivel >= 1
}

function bumpUltimo(map: Map<string, number>, uid: string | null | undefined, iso: string | null | undefined) {
  if (!uid || !iso) return
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return
  const prev = map.get(uid) ?? 0
  if (t > prev) map.set(uid, t)
}

async function coletarUltimaAtividade(
  adminDb: SupabaseClient,
  usuarioIds: string[],
  desde: Date,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (usuarioIds.length === 0) return map

  const desdeIso = desde.toISOString()

  const fontes = await Promise.all([
    adminDb.from('buscas_guia').select('usuario_id, created_at').in('usuario_id', usuarioIds).gte('created_at', desdeIso),
    adminDb.from('atividades').select('autor_id, created_at').in('autor_id', usuarioIds).gte('created_at', desdeIso),
    adminDb
      .from('perfil_visitas')
      .select('visitante_usuario_id, visitado_em')
      .in('visitante_usuario_id', usuarioIds)
      .gte('visitado_em', desdeIso),
    adminDb.from('curtidas').select('usuario_id, created_at').in('usuario_id', usuarioIds).gte('created_at', desdeIso),
    adminDb.from('comentarios').select('autor_id, created_at').in('autor_id', usuarioIds).gte('created_at', desdeIso),
    adminDb.from('redecontatos').select('seguidor_id, created_at').in('seguidor_id', usuarioIds).gte('created_at', desdeIso),
  ])

  for (const { data } of fontes) {
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      bumpUltimo(
        map,
        (r.usuario_id ?? r.autor_id ?? r.visitante_usuario_id ?? r.seguidor_id) as string | null,
        (r.created_at ?? r.visitado_em) as string | null,
      )
    }
  }

  return map
}

function contarFaixasAtividade(ultimos: Map<string, number>) {
  const now = Date.now()
  const ms24 = 24 * 60 * 60 * 1000
  const ms48 = 48 * 60 * 60 * 1000
  const ms72 = 72 * 60 * 60 * 1000

  let faixa24 = 0
  let faixa48 = 0
  let faixa72 = 0

  for (const t of ultimos.values()) {
    const diff = now - t
    if (diff <= ms24) faixa24 += 1
    else if (diff <= ms48) faixa48 += 1
    else if (diff <= ms72) faixa72 += 1
  }

  const faixas = [
    { label: '24 horas', valor: faixa24 },
    { label: '48 horas', valor: faixa48 },
    { label: '72 horas', valor: faixa72 },
  ]
  const total = faixas.reduce((s, f) => s + f.valor, 0)

  return faixas.map((f, i) => ({
    ...f,
    percentual: total > 0 ? (f.valor / total) * 100 : 0,
    cor: CORES_ATIVOS_FAIXA[i],
  }))
}

async function idsPorPerfil(adminDb: SupabaseClient, perfil: PerfilAtivos): Promise<string[]> {
  if (perfil === 'turistas') {
    const { data, error } = await adminDb.from('turistas').select('usuario_id')
    if (error) throw error
    return (data ?? []).map((r) => String((r as { usuario_id: string }).usuario_id)).filter(Boolean)
  }

  const { data, error } = await adminDb.from('profissionais').select('usuario_id')
  if (error) throw error
  return (data ?? []).map((r) => String((r as { usuario_id: string }).usuario_id)).filter(Boolean)
}

/** Conta cadastrados com atividade real nas faixas 24h / 48h / 72h (exclusivas). */
export async function GET(req: Request) {
  try {
    const session = await assertAdminSession()
    if (!session.ok) return session.error

    const { userId: authUserId, email: authEmail } = session

    let adminDb: SupabaseClient
    try {
      adminDb = createSupabaseAdmin()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'service_role_missing'
      return jsonAdminError(503, 'service_role', msg)
    }

    const { row: adminRow } = await loadAdminUsuarioRow(authUserId, authEmail)
    if (!adminRow) {
      return jsonAdminError(403, 'admin_not_found', 'Administrador não encontrado.')
    }

    const role = String(adminRow.role ?? '')
    const nivel = Number(adminRow.admin_level ?? 0)
    if (!isAdminRole(role, nivel)) {
      return jsonAdminError(403, 'permission', 'Sem permissão de administrador.')
    }

    const url = new URL(req.url)
    const perfilRaw = String(url.searchParams.get('perfil') ?? 'turistas').trim()
    if (perfilRaw !== 'turistas' && perfilRaw !== 'profissionais') {
      return jsonAdminError(400, 'params', 'Parâmetro perfil inválido.')
    }
    const perfil = perfilRaw as PerfilAtivos

    const desde = new Date()
    desde.setHours(desde.getHours() - 72)

    const usuarioIds = await idsPorPerfil(adminDb, perfil)
    const ultimos = await coletarUltimaAtividade(adminDb, usuarioIds, desde)

    return NextResponse.json({ faixas: contarFaixasAtividade(ultimos) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'ativos', msg)
  }
}
