import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { parseTourConfig, sincronizarTourComFotos, storagePathFromPublicUrl } from '@/lib/pannellumTour'
import type { TourConfig } from '@/lib/tour360Types'
import { getUserFromCookieSession } from '@/lib/serverAuthSession'

async function assertAdmin() {
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          /* leitura da sessão */
        },
      },
    }
  )

  const { user, error: authErr } = await getUserFromCookieSession(supabaseAuth)
  if (authErr || !user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  const { data: rowUser } = await supabaseAuth.from('usuarios').select('role').eq('id', user.id).maybeSingle()
  if (String(rowUser?.role ?? '') !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }

  return { admin: createSupabaseAdmin() }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

export async function PATCH(req: Request) {
  try {
    const auth = await assertAdmin()
    if ('error' in auth && auth.error) return auth.error
    const admin = auth.admin!

    let body: { empresaId?: unknown; fotos_360_url?: unknown; tour_config?: unknown } = {}
    try {
      body = (await req.json()) as typeof body
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const empresaId = typeof body.empresaId === 'string' ? body.empresaId.trim() : ''
    if (!empresaId) {
      return NextResponse.json({ error: 'missing_empresaId' }, { status: 400 })
    }

    const payload: { fotos_360_url?: string[]; tour_config?: TourConfig } = {}

    if (body.fotos_360_url !== undefined) {
      payload.fotos_360_url = asStringArray(body.fotos_360_url)
    }

    if (body.tour_config !== undefined) {
      payload.tour_config = parseTourConfig(body.tour_config)
    }

    if (payload.fotos_360_url && !body.tour_config) {
      const { data: row } = await admin.from('empresas').select('tour_config').eq('id', empresaId).maybeSingle()
      const tourAtual = parseTourConfig(row?.tour_config)
      payload.tour_config = sincronizarTourComFotos(payload.fotos_360_url, tourAtual)
    }

    if (!Object.keys(payload).length) {
      return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
    }

    const { error } = await admin.from('empresas').update(payload).eq('id', empresaId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'server_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await assertAdmin()
    if ('error' in auth && auth.error) return auth.error
    const admin = auth.admin!

    let body: { empresaId?: unknown; url?: unknown } = {}
    try {
      body = (await req.json()) as typeof body
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const empresaId = typeof body.empresaId === 'string' ? body.empresaId.trim() : ''
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!empresaId || !url) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    const { data: row, error: selErr } = await admin
      .from('empresas')
      .select('fotos_360_url, tour_config')
      .eq('id', empresaId)
      .maybeSingle()

    if (selErr || !row) {
      return NextResponse.json({ error: selErr?.message ?? 'empresa_not_found' }, { status: 404 })
    }

    const fotos = asStringArray(row.fotos_360_url).filter((u) => u !== url)
    const tour = sincronizarTourComFotos(fotos, parseTourConfig(row.tour_config))

    const { error: upErr } = await admin
      .from('empresas')
      .update({ fotos_360_url: fotos, tour_config: tour })
      .eq('id', empresaId)

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    const path = storagePathFromPublicUrl(url)
    if (path) {
      await admin.storage.from('empresas').remove([path])
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'server_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
