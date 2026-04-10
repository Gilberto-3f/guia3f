import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function trimSlash(s: string) {
  return s.replace(/\/$/, '')
}

function getEnvSiteBase(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return trimSlash(explicit)
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const v = vercel.replace(/^https?:\/\//, '')
    return `https://${v}`
  }
  return ''
}

/**
 * URL absoluta de callback (lista em Supabase → Authentication → URL Configuration → Redirect URLs).
 */
export function resolveAuthCallbackUrl(req: NextRequest, redirectOriginFromForm: string): string {
  const envBase = getEnvSiteBase()
  const raw = redirectOriginFromForm.trim()

  try {
    if (raw.startsWith('http')) {
      const formUrl = new URL(raw)
      const origin = trimSlash(formUrl.origin)
      const host = formUrl.host
      const isLocal =
        host === 'localhost' || host.startsWith('127.') || host.endsWith('.local')
      const isVercel = host.endsWith('.vercel.app')

      if (envBase) {
        const envHost = new URL(envBase).host
        if (host === envHost || isLocal || isVercel) {
          return `${origin}/auth/callback`
        }
      } else if (isLocal || isVercel) {
        return `${origin}/auth/callback`
      }
    }
  } catch {
    /* origem inválida */
  }

  if (envBase) return `${envBase}/auth/callback`

  const reqOrigin = trimSlash(new URL(req.url).origin)
  return `${reqOrigin}/auth/callback`
}

/**
 * Envia magic link via cliente anon no servidor (evita depender só do browser após admin.createUser).
 */
export async function enviarMagicLinkAposCadastro(email: string, callbackAbsoluteUrl: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return { error: new Error('NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY em falta') }
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: callbackAbsoluteUrl,
      shouldCreateUser: false,
    },
  })

  return { error: error ?? null }
}
