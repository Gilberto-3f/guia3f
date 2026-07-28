import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

function norm(q: string): string {
  return q.trim().replace(/^@+/, '')
}

const USUARIO_CONVITE_SELECT = 'id, email, username, role, admin_level'

/** Busca exata por username ou nome social (ADM Geral — convite). */
export async function GET(req: Request) {
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

    const url = new URL(req.url)
    const q = norm(url.searchParams.get('q') ?? '')
    const somenteAuxiliar = url.searchParams.get('somente_auxiliar') === '1'

    if (q.length < 2) {
      return NextResponse.json({ error: 'Informe nome ou username.' }, { status: 400 })
    }

    const { data: porUsername } = await adminDb
      .from('usuarios')
      .select(USUARIO_CONVITE_SELECT)
      .ilike('username', q)
      .limit(5)

    let usuario =
      (porUsername ?? []).find((u) => norm(String(u.username ?? '')).toLowerCase() === q.toLowerCase()) ?? null

    if (!usuario) {
      const { data: tur } = await adminDb
        .from('turistas')
        .select('usuario_id, nome_completo, nome_usuario')
        .or(`nome_usuario.ilike.${q},nome_completo.ilike.${q}`)
        .limit(5)

      const turHit = (tur ?? []).find(
        (t) =>
          norm(String(t.nome_usuario ?? '')).toLowerCase() === q.toLowerCase() ||
          norm(String(t.nome_completo ?? '')).toLowerCase() === q.toLowerCase(),
      )
      if (turHit?.usuario_id) {
        const { data: u } = await adminDb
          .from('usuarios')
          .select(USUARIO_CONVITE_SELECT)
          .eq('id', turHit.usuario_id)
          .maybeSingle()
        usuario = u
      }
    }

    if (!usuario) {
      const { data: profs } = await adminDb
        .from('profissionais')
        .select('usuario_id, nome_completo, nome_usuario')
        .or(`nome_usuario.ilike.${q},nome_completo.ilike.${q}`)
        .limit(5)

      const profHit = (profs ?? []).find(
        (p) =>
          norm(String(p.nome_usuario ?? '')).toLowerCase() === q.toLowerCase() ||
          norm(String(p.nome_completo ?? '')).toLowerCase() === q.toLowerCase(),
      )
      if (profHit?.usuario_id) {
        const { data: u } = await adminDb
          .from('usuarios')
          .select(USUARIO_CONVITE_SELECT)
          .eq('id', profHit.usuario_id)
          .maybeSingle()
        usuario = u
      }
    }

    if (!usuario?.id) {
      return NextResponse.json({ ok: true, usuario: null })
    }

    if (somenteAuxiliar && Number(usuario.admin_level) !== 4) {
      return NextResponse.json({
        ok: true,
        usuario: null,
        error: 'Usuário encontrado, mas não é Auxiliar ADM (nível 4).',
      })
    }

    const uid = String(usuario.id)
    let nomeSocial = ''
    let username = norm(String(usuario.username ?? ''))
    let fotoUrl: string | null = null

    const { data: prof } = await adminDb
      .from('profissionais')
      .select('nome_completo, nome_usuario, foto_perfil_url')
      .eq('usuario_id', uid)
      .maybeSingle()
    if (prof) {
      nomeSocial = String(prof.nome_completo ?? nomeSocial).trim()
      username = norm(String(prof.nome_usuario ?? username)) || username
      fotoUrl = prof.foto_perfil_url != null ? String(prof.foto_perfil_url) : null
    } else {
      const { data: tur } = await adminDb
        .from('turistas')
        .select('nome_completo, nome_usuario, foto_url')
        .eq('usuario_id', uid)
        .maybeSingle()
      if (tur) {
        nomeSocial = String(tur.nome_completo ?? nomeSocial).trim()
        username = norm(String(tur.nome_usuario ?? username)) || username
        fotoUrl = tur.foto_url != null ? String(tur.foto_url) : null
      }
    }

    return NextResponse.json({
      ok: true,
      usuario: {
        id: uid,
        email: usuario.email,
        username,
        nome_social: nomeSocial || username,
        foto_url: fotoUrl,
        role: usuario.role,
        admin_level: usuario.admin_level,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
