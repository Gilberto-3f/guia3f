import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

type Ctx = { params: Promise<{ id: string }> }

async function requireAdmGeral() {
  const auth = await assertAdminSession()
  if (!auth.ok) return { ok: false as const, error: auth.error }
  const { row } = await loadAdminUsuarioRow(auth.userId, auth.email)
  if (Number(row?.admin_level ?? 0) !== 1) {
    return { ok: false as const, error: jsonAdminError(403, 'forbidden', 'Só o ADM geral publica banners.') }
  }
  let adminDb
  try {
    adminDb = createSupabaseAdmin()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'service_role_unavailable'
    return { ok: false as const, error: jsonAdminError(503, 'admin_db', msg) }
  }
  return { ok: true as const, adminDb }
}

export async function PATCH(_req: Request, ctx: Ctx) {
  try {
    const gate = await requireAdmGeral()
    if (!gate.ok) return gate.error
    const { id } = await ctx.params
    const anuncioId = String(id ?? '').trim()
    if (!anuncioId) return jsonAdminError(400, 'id', 'id obrigatório.')

    const { data, error } = await gate.adminDb
      .from('anuncios')
      .update({ status: 'inativo' })
      .eq('id', anuncioId)
      .is('empresa_id', null)
      .eq('tipo', 'home')
      .eq('status', 'ativo')
      .select('id')
    if (error) return jsonAdminError(400, 'update', error.message)
    if (!data || data.length === 0) {
      return jsonAdminError(400, 'update', 'Este banner não está ativo ou já foi finalizado.')
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'patch', msg)
  }
}
