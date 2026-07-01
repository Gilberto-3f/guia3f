import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** ADM Geral atualiza % de bonificação de um colaborador. */
export async function PATCH(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const adminDb = createSupabaseAdmin()
    const { data: solicitante } = await adminDb
      .from('usuarios')
      .select('admin_level')
      .eq('id', session.userId)
      .maybeSingle()

    if (Number(solicitante?.admin_level) !== 1) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const usuarioId = String(body.usuario_id ?? '').trim()
    const pct = Number(body.participacao_percentual)

    if (!usuarioId || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'Informe usuario_id e percentual entre 0 e 100.' }, { status: 400 })
    }

    const { data: alvo } = await adminDb
      .from('usuarios')
      .select('id, admin_permissoes, admin_level')
      .eq('id', usuarioId)
      .maybeSingle()

    if (!alvo?.id || Number(alvo.admin_level) < 2) {
      return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 })
    }

    const perms =
      alvo.admin_permissoes && typeof alvo.admin_permissoes === 'object'
        ? { ...(alvo.admin_permissoes as Record<string, unknown>) }
        : {}

    const { error: upErr } = await adminDb
      .from('usuarios')
      .update({
        admin_permissoes: { ...perms, participacao_percentual: pct },
      })
      .eq('id', usuarioId)

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, participacao_percentual: pct })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
