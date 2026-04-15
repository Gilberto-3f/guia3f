import { parse, serialize } from 'cookie'
import { createBrowserClient, isBrowser, memoryLocalStorageAdapter } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Cookies só com tokens (menor payload) + user no localStorage — recomendado pelo
 * @supabase/ssr para Safari / PWA, onde cookies grandes costumam falhar.
 * Deve usar o mesmo `encode: 'tokens-only'` no createServerClient (middleware + routes).
 */
const browserCookies = {
  encode: 'tokens-only',
  getAll() {
    if (typeof document === 'undefined') return []
    const parsed = parse(document.cookie ?? '')
    return Object.keys(parsed).map((name) => ({
      name,
      value: parsed[name] ?? '',
    }))
  },
  setAll(cookiesToSet, _responseHeaders) {
    if (typeof document === 'undefined') return
    cookiesToSet.forEach(({ name, value, options }) => {
      document.cookie = serialize(name, value, options ?? {})
    })
  },
}

/** Evita `window.localStorage` na avaliação do módulo durante prerender/SSR (tokens-only). */
const userStorage = isBrowser() ? globalThis.localStorage : memoryLocalStorageAdapter()

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookies: browserCookies,
  auth: { userStorage },
})
