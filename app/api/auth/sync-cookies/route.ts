import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Replica a sessão do browser (localStorage) nos cookies HttpOnly do domínio,
 * para o middleware e o createServerClient enxergarem a mesma sessão (Safari / PWA).
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
    }
  )

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
    }
  )

  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
