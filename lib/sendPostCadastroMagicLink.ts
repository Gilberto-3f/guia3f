import { supabase } from '@/lib/supabase'

/**
 * Fallback no browser: OTP para e-mail já existente (ex.: se o envio no servidor falhar).
 * O fluxo principal envia o link em `app/api/cadastro/*` e `app/api/auth/magic-link`.
 */
export async function sendPostCadastroMagicLink(email: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: false,
    },
  })
  if (!error) {
    await supabase.auth.signOut()
  }
  return { error }
}
