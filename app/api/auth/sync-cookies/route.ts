import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function jwtAindaValido(accessToken: string, margemSec = 60): boolean {
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return false
    const pad = payload.length % 4 === 0 ? '' : '='.repeat(4 - (payload.length % 4))
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/') + pad)) as {
      exp?: number
    }
    const exp = Number(json.exp)
    return Number.isFinite(exp) && exp * 1000 > Date.now() + margemSec * 1000
  } catch {
    return false
  }
}

/**
 * Replica a sessão do browser (localStorage) nos cookies HttpOnly do domínio,
 * para o middleware e o createServerClient enxergarem a mesma sessão (Safari / PWA).
 *
 * Evita `setSession` (que pode bater em Auth `/token` ou `/user`) quando os cookies
 * já têm os mesmos tokens e o access JWT ainda é válido.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const access_token =
    typeof body === 'object' && body !== null && 'access_token' in body
      ? String((body as { access_token?: unknown }).access_token ?? '')
      : ''
  const refresh_token =
    typeof body === 'object' && body !== null && 'refresh_token' in body
      ? String((body as { refresh_token?: unknown }).refresh_token ?? '')
      : ''

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'missing_tokens' }, { status: 400 })
  }

  // Não chama setSession (→ GET /user no Auth) com JWT já expirado.
  // O cliente deve refreshSession antes e só então sincronizar cookies.
  if (!jwtAindaValido(access_token)) {
    return NextResponse.json({ error: 'expired_access', skipped: true }, { status: 409 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        encode: 'tokens-only',
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            /* set pode falhar em alguns contextos */
          }
        },
      },
    },
  )

  // Leitura local dos cookies — sem rede Auth.
  const {
    data: { session: existing },
  } = await supabase.auth.getSession()

  if (
    existing?.access_token === access_token &&
    existing?.refresh_token === refresh_token &&
    jwtAindaValido(access_token)
  ) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}

/** Limpa cookies de auth no servidor (logout); alinha com signOut no cliente. */
export async function DELETE() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        encode: 'tokens-only',
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            /* ignore */
          }
        },
      },
    },
  )

  await supabase.auth.signOut({ scope: 'local' })
  return NextResponse.json({ ok: true })
}
