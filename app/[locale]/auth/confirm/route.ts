import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/guia'

  if (token_hash && type) {
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
          setAll(cookiesToSet, _responseHeaders) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              /* set pode falhar em alguns contextos de render */
            }
          },
        },
      }
    )

    await supabase.auth.verifyOtp({
      type: type as 'email' | 'signup' | 'recovery' | 'email_change' | 'magiclink',
      token_hash,
    })
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
