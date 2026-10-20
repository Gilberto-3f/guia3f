import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { adminNivelTemBlocoFixo, mesclarEcossistemaNasPermissoes } from '@/lib/adminEcossistema'

export async function PATCH(req: Request) {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error
    const { row } = await loadAdminUsuarioRow(auth.userId, auth.email)
    if (Number(row?.admin_level) !== 1) {
      return jsonAdminError(403, 'forbidden', 'Apenas ADM GERAL pode alterar o bloco do colaborador.')
    }

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return jsonAdminError(400, 'json', 'JSON inválido.')
    }

    const usuarioId = String(body.usuario_id ?? '').trim()
    const ecoId = String(body.ecossistema_id ?? '').trim()
    if (!usuarioId || !ecoId) {
      return jsonAdminError(400, 'params', 'Informe o colaborador e o bloco.')
    }

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'service_role_unavailable'
      return jsonAdminError(503, 'admin_db', msg)
    }

    const { data: alvo } = await adminDb
      .from('usuarios')
      .select('id, admin_level, admin_permissoes')
      .eq('id', usuarioId)
      .maybeSingle()

    if (!alvo?.id) return jsonAdminError(404, 'alvo', 'Colaborador não encontrado.')
    if (!adminNivelTemBlocoFixo(Number(alvo.admin_level))) {
      return jsonAdminError(400, 'nivel', 'Só moderador e auxiliar ficam vinculados a um bloco.')
    }

    const { data: eco } = await adminDb.from('ecossistemas').select('id, nome').eq('id', ecoId).maybeSingle()
    if (!eco?.id) return jsonAdminError(400, 'eco', 'Ecossistema inválido.')

    const perms = mesclarEcossistemaNasPermissoes(
      alvo.admin_permissoes && typeof alvo.admin_permissoes === 'object'
        ? (alvo.admin_permissoes as Record<string, unknown>)
        : {},
      ecoId,
    )

    const { error: upErr } = await adminDb
      .from('usuarios')
      .update({ ecossistema_id: ecoId, admin_permissoes: perms })
      .eq('id', usuarioId)
    if (upErr) return jsonAdminError(400, 'update', upErr.message)

    return NextResponse.json({ ok: true, ecossistema_id: ecoId, nome: eco.nome })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'patch', msg)
  }
}
