import { NextRequest, NextResponse } from 'next/server'
import {
  createAuthUserForCadastro,
  upsertUsuarioCadastro,
} from '@/lib/cadastroCreateAuthUser'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const usernameRegex = /^[a-z0-9._]{3,20}$/

export async function POST(req: NextRequest) {
  try {
    const admin = createSupabaseAdmin()
    const form = await req.formData()
    const email = String(form.get('email') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    const nomeCompleto = String(form.get('nomeCompleto') || '').trim()
    const nomeUsuario = String(form.get('nomeUsuario') || '').trim().toLowerCase().replace(/^@+/, '')
    const whatsapp = String(form.get('whatsapp') || '').trim()

    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }
    if (!senhaRegex.test(password)) {
      return NextResponse.json({ error: 'invalid_password' }, { status: 400 })
    }
    if (!nomeCompleto) {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
    }
    if (!usernameRegex.test(nomeUsuario)) {
      return NextResponse.json({ error: 'invalid_username' }, { status: 400 })
    }
    if (!whatsapp) {
      return NextResponse.json({ error: 'invalid_whatsapp' }, { status: 400 })
    }
    if (form.get('aceitePoliticas') !== 'true' && (form.get('aceitePolitica') !== 'true' || form.get('aceiteTermos') !== 'true')) {
      return NextResponse.json({ error: 'policies' }, { status: 400 })
    }

    const { data: uCheck } = await admin.from('turistas').select('id').eq('nome_usuario', nomeUsuario).limit(1)
    const { data: pCheck } = await admin
      .from('profissionais')
      .select('id')
      .eq('nome_usuario', nomeUsuario)
      .limit(1)
    const { data: eCheck } = await admin.from('empresas').select('id').eq('nome_usuario', nomeUsuario).limit(1)
    if ((uCheck?.length ?? 0) + (pCheck?.length ?? 0) + (eCheck?.length ?? 0) > 0) {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }

    const authResult = await createAuthUserForCadastro(admin, {
      email,
      password,
      role: 'turista',
    })
    if (!authResult.ok) {
      if (authResult.kind === 'email_exists') {
        return NextResponse.json({ error: 'email_exists' }, { status: 409 })
      }
      if (authResult.kind === 'auth_database_error') {
        console.error('[cadastro/turista] createUser:', authResult.error)
        return NextResponse.json({ error: 'auth_database_error' }, { status: 503 })
      }
      return NextResponse.json({ error: authResult.error }, { status: 400 })
    }

    const userId = authResult.user.id

    const { error: usuarioErr } = await upsertUsuarioCadastro(admin, {
      id: userId,
      email,
      role: 'turista',
    })
    if (usuarioErr) {
      try {
        await admin.auth.admin.deleteUser(userId)
      } catch {
        /* ignore */
      }
      return NextResponse.json({ error: usuarioErr }, { status: 500 })
    }

    const payload: Record<string, unknown> = {
      usuario_id: userId,
      nome_completo: nomeCompleto,
      nome_usuario: nomeUsuario,
      whatsapp,
      status: 'pre_aprovado',
    }

    let ins = await admin.from('turistas').insert(payload)
    if (ins.error && `${ins.error.message}`.toLowerCase().includes('status')) {
      const { status: _s, ...rest } = payload
      ins = await admin.from('turistas').insert(rest)
    }
    if (ins.error && `${ins.error.message}`.toLowerCase().includes('whatsapp')) {
      const { whatsapp: _w, ...rest } = payload
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
