import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'
import { persistirLeituraCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissionalLeitura.server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getUserFromCookieSession } from '@/lib/serverAuthSession'

/** Profissional (incl. anfitrião) marca aviso(s) do canal financeiro como lido(s). */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      },
    )

    const { user, error: authErr } = await getUserFromCookieSession(supabase)

    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { data: urow } = await supabase.from('usuarios').select('role').eq('id', user.id).maybeSingle()
    const role = String(urow?.role ?? '')
    if (role === 'turista' || role === 'admin') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { data: prof } = await supabase
      .from('profissionais')
      .select('id, categorias')
      .eq('usuario_id', user.id)
      .maybeSingle()

    const profissionalId = prof?.id != null ? String(prof.id) : ''
    if (!profissionalId) {
      return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 404 })
    }

    const cats = Array.isArray(prof?.categorias)
      ? prof.categorias.filter((c): c is string => typeof c === 'string')
      : []
    const marcarManifestoLegado = categoriasIncluemAnfitriao(cats)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const itemId = String(body.item_id ?? '').trim() || undefined

    let admin
    try {
      admin = createSupabaseAdmin()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'service_role_unavailable'
      return NextResponse.json({ error: msg }, { status: 503 })
    }

    const ok = await persistirLeituraCanalFinanceiroProfissional(admin, profissionalId, itemId, {
      marcarManifestoLegado,
    })
    if (!ok) {
      return NextResponse.json({ error: 'Não foi possível marcar como lido.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
