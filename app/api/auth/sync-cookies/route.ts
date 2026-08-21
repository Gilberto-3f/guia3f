import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { jwtAindaValido, userFromAccessToken } from '@/lib/serverAuthSession'

function fetchSemGetUserAuth(accessToken: string): typeof fetch {
  const orig = fetch.bind(globalThis)
  return async (input, init) => {
    const url = typeof input === 'string' ? input : String((input as Request)?.url ?? '')
    if (url.includes('/auth/v1/user') && jwtAindaValido(accessToken)) {
      const user = userFromAccessToken(accessToken)
      return new Response(JSON.stringify(user), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return orig(input, init)
  }
}

/**
 * Replica a sessão do browser (localStorage) nos cookies HttpOnly do domínio,
 * para o middleware e o createServerClient enxergarem a mesma sessão (Safari / PWA).
 *
 * Evita `setSession` (que pode bater em Auth `/token` ou `/user`) quando os cookies
 * já têm os mesmos tokens e o access JWT ainda é válido.
 * Com JWT válido, `setSession` não chama GoTrue — o GET /user é respondido localmente.
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
      global: {
        fetch: fetchSemGetUserAuth(access_token),
      },
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
