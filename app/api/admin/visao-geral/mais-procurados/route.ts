import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { buscarMaisProcuradosTuristas } from '@/lib/adminMaisProcuradosTuristas'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

type PeriodoParam = '7d' | '30d' | '90d' | '12m'

function periodoParaDias(periodo: PeriodoParam): number {
  if (periodo === '7d') return 7
  if (periodo === '30d') return 30
  if (periodo === '90d') return 90
  return 365
}

function isAdminRole(role: string, nivel: number): boolean {
  return role === 'admin' || nivel >= 1
}

/** Segmentos de maior procura (visibilidade + engajamento) apenas de turistas. */
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
    const periodoRaw = String(url.searchParams.get('periodo') ?? '30d').trim() as PeriodoParam
    const periodosValidos: PeriodoParam[] = ['7d', '30d', '90d', '12m']
    const periodo = periodosValidos.includes(periodoRaw) ? periodoRaw : '30d'

    const desde = new Date()
    desde.setDate(desde.getDate() - periodoParaDias(periodo))

    const dados = await buscarMaisProcuradosTuristas(adminDb, desde)
    return NextResponse.json(dados)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'mais_procurados', msg)
  }
}
