import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  clearPasswordChangeFailures,
  getPasswordChangeLockStatus,
  recordPasswordChangeFailure,
} from '@/lib/passwordChangeRateLimit'
import { normalizeEmailLocale } from '@/lib/emailSenhaAlterada'
import { sendAccountDeletedEmail } from '@/lib/emailContaExcluida'
import { purgeUserStorage } from '@/lib/excluirContaStorage'

export async function POST(req: NextRequest) {
  const session = await assertUserSession()
  if (!session.ok) return session.error

  const { userId, email, role } = session
  if (!email) {
    return NextResponse.json({ error: 'no_email' }, { status: 400 })
  }
  if (role === 'admin') {
    return NextResponse.json({ error: 'admin_forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const senhaAtual = String(obj.senhaAtual ?? '')
  const confirmou = obj.confirmou === true
  const locale = normalizeEmailLocale(obj.locale)

  if (!confirmou) {
    return NextResponse.json({ error: 'not_confirmed' }, { status: 400 })
  }
  if (!senhaAtual) {
    return NextResponse.json({ error: 'missing_current' }, { status: 400 })
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

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch (err) {
    console.error('[excluir-conta] admin', err)
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 })
  }

  const { data: empresas } = await admin.from('empresas').select('id').eq('usuario_id', userId)
  const empresaIds = (empresas ?? []).map((e: { id: string }) => String(e.id)).filter(Boolean)

  try {
    await purgeUserStorage(admin, userId, empresaIds)
  } catch (err) {
    console.warn('[excluir-conta] storage', err)
  }

  const { data: rpcData, error: rpcErr } = await admin.rpc('excluir_conta_usuario', {
    p_uid: userId,
  })

  if (rpcErr) {
    console.error('[excluir-conta] rpc', rpcErr.message)
    const msg = rpcErr.message || ''
    if (/excluir_conta_usuario|schema cache|does not exist/i.test(msg)) {
      return NextResponse.json({ error: 'rpc_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }

  const result =
    rpcData && typeof rpcData === 'object' ? (rpcData as { ok?: boolean; error?: string }) : {}
  if (!result.ok) {
    const code = String(result.error || 'delete_failed')
    if (code === 'fk_blocked') {
      console.error('[excluir-conta] fk_blocked', result)
    }
    const status =
      code === 'admin_forbidden'
        ? 403
        : code === 'active_ride' || code === 'active_reservation' || code === 'active_manifesto'
          ? 409
          : 400
    return NextResponse.json({ error: code }, { status })
  }

  clearPasswordChangeFailures(userId)

  const mail = await sendAccountDeletedEmail({ to: email, locale })

  try {
    await admin.auth.admin.deleteUser(userId)
  } catch (err) {
    console.error('[excluir-conta] deleteUser', err)
  }

  return NextResponse.json({
    ok: true,
    emailSent: mail.sent,
    emailSkipped: Boolean(mail.skipped),
  })
}
