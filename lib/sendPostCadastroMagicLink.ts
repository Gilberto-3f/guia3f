import { supabase } from '@/lib/supabase'

/**
 * Após criar o utilizador via API (service role), o Auth não envia e-mail de confirmação sozinho.
 * Dispara o mesmo magic link usado no fluxo logado (OTP para e-mail já existente).
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
