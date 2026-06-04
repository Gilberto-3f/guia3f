import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { defaultUsernameForCadastro } from '@/lib/cadastroUsername'

const MAX_USERNAME_LEN = 20
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export async function POST(req: NextRequest) {
  try {
    const admin = createSupabaseAdmin()
    const form = await req.formData()
    const email = String(form.get('email') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    const nomeCompleto = String(form.get('nomeCompleto') || '').trim()

    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }
    if (!senhaRegex.test(password)) {
      return NextResponse.json({ error: 'invalid_password' }, { status: 400 })
    }
    if (!nomeCompleto) {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
    }
    if (form.get('aceitePolitica') !== 'true' || form.get('aceiteTermos') !== 'true') {
      return NextResponse.json({ error: 'policies' }, { status: 400 })
    }

    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'turista' },
    })
    if (cuErr) {
      const msg = (cuErr.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'email_exists' }, { status: 409 })
      }
      return NextResponse.json({ error: cuErr.message }, { status: 400 })
    }

    const userId = created.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'no_user' }, { status: 500 })
    }

    let nomeUsuario = defaultUsernameForCadastro(email, userId)
    const payload: Record<string, unknown> = {
      usuario_id: userId,
      nome_completo: nomeCompleto,
      nome_usuario: nomeUsuario,
      status: 'pre_aprovado',
    }

    let ins = await admin.from('turistas').insert(payload)
    if (ins.error && `${ins.error.message}`.toLowerCase().includes('nome_usuario')) {
      nomeUsuario = `${nomeUsuario.slice(0, 12)}${String(Date.now()).slice(-6)}`.slice(0, MAX_USERNAME_LEN)
      ins = await admin.from('turistas').insert({ ...payload, nome_usuario: nomeUsuario })
    }
    if (ins.error && `${ins.error.message}`.toLowerCase().includes('status')) {
      const { status: _s, ...rest } = payload
      ins = await admin.from('turistas').insert(rest)
    }
    if (ins.error) {
      try {
        await admin.auth.admin.deleteUser(userId)
      } catch {
        /* ignore */
      }
      return NextResponse.json({ error: ins.error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('em falta')) {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
