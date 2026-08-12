import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import {
  clearPasswordChangeFailures,
  getPasswordChangeLockStatus,
  recordPasswordChangeFailure,
} from '@/lib/passwordChangeRateLimit'
import { normalizeEmailLocale, sendPasswordChangedEmail } from '@/lib/emailSenhaAlterada'

const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export async function POST(req: NextRequest) {
  const session = await assertUserSession()
  if (!session.ok) return session.error

  const { supabase, userId, email } = session
  if (!email) {
    return NextResponse.json({ error: 'no_email' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const senhaAtual = String(obj.senhaAtual ?? '')
  const senhaNova = String(obj.senhaNova ?? '')
  const locale = normalizeEmailLocale(obj.locale)

  if (!senhaAtual) {
    return NextResponse.json({ error: 'missing_current' }, { status: 400 })
  }
  if (!senhaRegex.test(senhaNova)) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 400 })
  }
  if (senhaAtual === senhaNova) {
    return NextResponse.json({ error: 'same_password' }, { status: 400 })
  }

  const lock = getPasswordChangeLockStatus(userId)
  if (lock.blocked) {
    return NextResponse.json(
      { error: 'locked', retryAfterSec: lock.retryAfterSec },
      { status: 429 },
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 })
  }

  // Client efêmero: valida a senha atual sem alterar cookies do app.
  const verifyClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: verifyErr } = await verifyClient.auth.signInWithPassword({
    email,
    password: senhaAtual,
  })

  if (verifyErr) {
    const after = recordPasswordChangeFailure(userId)
    if (after.blocked) {
      return NextResponse.json(
        { error: 'locked', retryAfterSec: after.retryAfterSec },
        { status: 429 },
      )
    }
    return NextResponse.json(
      {
        error: 'wrong_password',
        remainingAttempts: after.remainingAttempts,
      },
      { status: 401 },
    )
  }

  try {
    await verifyClient.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  }

  // Atualiza com a sessão do cookie (mantém este dispositivo logado).
  const { error: updateErr } = await supabase.auth.updateUser({ password: senhaNova })
  if (updateErr) {
    console.error('[alterar-senha] updateUser', updateErr.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  clearPasswordChangeFailures(userId)

  const mail = await sendPasswordChangedEmail({ to: email, locale })

  return NextResponse.json({
    ok: true,
    emailSent: mail.sent,
    emailSkipped: Boolean(mail.skipped),
  })
}
