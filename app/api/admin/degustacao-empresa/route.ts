import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { concederDegustacaoEmpresa } from '@/lib/degustacaoEmpresa'

/** ADM concede período de degustação a empresa verificada. */
export async function POST(req: Request) {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error

    const body = (await req.json()) as Record<string, unknown>
    const empresaId = String(body.empresa_id ?? '').trim()
    const empresaUsuarioId = String(body.empresa_usuario_id ?? '').trim()
    const username = String(body.username ?? '').trim()
    const dias = Number(body.dias)

    if (!empresaId || !empresaUsuarioId) {
      return NextResponse.json({ error: 'empresa_id e empresa_usuario_id são obrigatórios.' }, { status: 400 })
    }

    const { row: adminRow, actorId } = await loadAdminUsuarioRow(auth.userId, auth.email)
    const nivel = Number(adminRow?.admin_level ?? 0)
    const cargo = (adminRow?.admin_permissoes as { cargo?: string })?.cargo
    const isFinanceiro = nivel === 1 || cargo === 'FINANCEIRO'
    if (!isFinanceiro) {
      return jsonAdminError(403, 'forbidden', 'Apenas ADM Geral ou ADM Financeiro podem conceder degustação.')
    }

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'service_role_unavailable'
      return jsonAdminError(503, 'admin_db', msg)
    }

    const res = await concederDegustacaoEmpresa(adminDb, {
      empresaId,
      empresaUsuarioId,
      username,
      dias,
      admUsuarioId: actorId,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Erro ao conceder degustação.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, degustacao_id: res.degustacaoId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
