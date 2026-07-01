import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { cargoPorNivel, permissoesPadraoPorNivel } from '@/lib/adminConvites'

export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }

    const { data: solicitante } = await adminDb
      .from('usuarios')
      .select('id, admin_level, email, username')
      .eq('id', session.userId)
      .maybeSingle()

    if (Number(solicitante?.admin_level) !== 1) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const usuarioId = String(body.usuario_id ?? '').trim()
    const nivel = Number(body.nivel)
    const comunidade = body.comunidade != null ? String(body.comunidade).trim() : ''
    const paisRaw = body.pais != null ? String(body.pais).trim().toUpperCase() : ''
    const pais = ['BR', 'AR', 'PY'].includes(paisRaw) ? paisRaw : ''

    if (!usuarioId || ![2, 3, 4].includes(nivel)) {
      return NextResponse.json({ error: 'params' }, { status: 400 })
    }
    if (nivel === 2 && !comunidade) {
      return NextResponse.json({ error: 'Selecione a comunidade do moderador.' }, { status: 400 })
    }
    if (nivel === 2 && !pais) {
      return NextResponse.json({ error: 'Selecione o país do moderador.' }, { status: 400 })
    }

    const { data: alvo } = await adminDb
      .from('usuarios')
      .select('id, email, username, admin_level, role')
      .eq('id', usuarioId)
      .maybeSingle()

    if (!alvo?.id) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    if (Number(alvo.admin_level) === 1 || String(alvo.role) === 'admin' && Number(alvo.admin_level) >= 1) {
      return NextResponse.json({ error: 'Este usuário já possui função administrativa.' }, { status: 409 })
    }

    const { data: pendente } = await adminDb
      .from('convites_admin')
      .select('id')
      .eq('usuario_id', usuarioId)
      .eq('status', 'pendente')
      .maybeSingle()

    if (pendente?.id) {
      return NextResponse.json({ error: 'Já existe convite pendente para este usuário.' }, { status: 409 })
    }

    const email = String(alvo.email ?? '').trim() || `${String(alvo.username ?? usuarioId).replace(/^@+/, '')}@guia3f.local`
    const codigo = Math.random().toString(36).slice(2, 10).toUpperCase()
    const permissoes = permissoesPadraoPorNivel(nivel, {
      comunidade: nivel === 2 ? comunidade : null,
      pais: nivel === 2 ? pais : null,
    })

    const { data: convite, error: insErr } = await adminDb
      .from('convites_admin')
      .insert({
        email,
        usuario_id: usuarioId,
        nivel,
        comunidade: nivel === 2 ? comunidade : null,
        pais: nivel === 2 ? pais : null,
        permissoes,
        convidado_por: session.userId,
        codigo,
        status: 'pendente',
        expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    if (insErr || !convite?.id) {
      return NextResponse.json({ error: insErr?.message ?? 'convite_falhou' }, { status: 400 })
    }

    await adminDb.from('logs_verificacao').insert({
      tipo: 'admin',
      perfil_id: usuarioId,
      acao: 'criou_convite_admin',
      admin_id: session.userId,
      admin_email: solicitante?.email ?? solicitante?.username ?? 'admin',
      admin_nivel: solicitante?.admin_level,
      detalhes: {
        usuario_id: usuarioId,
        nivel,
        comunidade: nivel === 2 ? comunidade : null,
        pais: nivel === 2 ? pais : null,
        cargo: cargoPorNivel(nivel),
      },
    })

    return NextResponse.json({ ok: true, convite_id: convite.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
