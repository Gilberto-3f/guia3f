import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { cargoPorNivel, permissoesPadraoPorNivel } from '@/lib/adminConvites'

export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const body = (await req.json()) as Record<string, unknown>
    const conviteId = String(body.convite_id ?? '').trim()
    const acao = String(body.acao ?? '').trim()

    if (!conviteId || !['aceitar', 'recusar'].includes(acao)) {
      return NextResponse.json({ error: 'params' }, { status: 400 })
    }

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }

    const { data: convite } = await adminDb
      .from('convites_admin')
      .select('*')
      .eq('id', conviteId)
      .eq('usuario_id', session.userId)
      .eq('status', 'pendente')
      .maybeSingle()

    if (!convite?.id) {
      return NextResponse.json({ error: 'Convite não encontrado ou expirado.' }, { status: 404 })
    }

    const expira = new Date(String(convite.expira_em)).getTime()
    if (!Number.isFinite(expira) || expira <= Date.now()) {
      await adminDb.from('convites_admin').update({ status: 'expirado' }).eq('id', conviteId)
      return NextResponse.json({ error: 'Convite expirado.' }, { status: 410 })
    }

    const now = new Date().toISOString()

    if (acao === 'recusar') {
      await adminDb.from('convites_admin').update({ status: 'recusado' }).eq('id', conviteId)
      return NextResponse.json({ ok: true, status: 'recusado' })
    }

    const nivel = Number(convite.nivel)
    const comunidade = convite.comunidade != null ? String(convite.comunidade) : null
    const perms = permissoesPadraoPorNivel(nivel, comunidade)

    const { error: upUserErr } = await adminDb
      .from('usuarios')
      .update({
        role: 'admin',
        admin_level: nivel,
        admin_permissoes: perms,
      })
      .eq('id', session.userId)

    if (upUserErr) {
      return NextResponse.json({ error: upUserErr.message ?? 'Não foi possível ativar o cargo.' }, { status: 400 })
    }

    await adminDb
      .from('convites_admin')
      .update({ status: 'aceito', aceito_em: now })
      .eq('id', conviteId)

    await adminDb.from('logs_verificacao').insert({
      tipo: 'admin',
      perfil_id: session.userId,
      acao: 'aceitou_convite_admin',
      admin_id: session.userId,
      detalhes: { nivel, cargo: cargoPorNivel(nivel), comunidade },
    })

    return NextResponse.json({ ok: true, status: 'aceito', admin_level: nivel })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
