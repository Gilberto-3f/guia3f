import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const usernameRegex = /^[a-z0-9._]{3,20}$/

const PLACA_CATEGORIAS = new Set(['Guia', 'Taxista', 'Van'])

type CadastroProfissionalBody = {
  email?: unknown
  password?: unknown
  nomeCompleto?: unknown
  nomeUsuario?: unknown
  categoria?: unknown
  pais?: unknown
  cidadeAtuacao?: unknown
  aceitePoliticas?: unknown
}

export async function POST(req: NextRequest) {
  try {
    const admin = createSupabaseAdmin()
    const body = (await req.json().catch(() => ({}))) as CadastroProfissionalBody

    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const nomeCompleto = String(body.nomeCompleto ?? '').trim()
    const nomeUsuario = String(body.nomeUsuario ?? '').trim().toLowerCase().replace(/^@+/, '')
    const categoria = String(body.categoria ?? '').trim()
    const pais = String(body.pais ?? '').trim()
    const cidadeRaw = String(body.cidadeAtuacao ?? '').trim()

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
    if (!categoria) {
      return NextResponse.json({ error: 'invalid_category' }, { status: 400 })
    }
    if (!['Brasil', 'Paraguai', 'Argentina'].includes(pais)) {
      return NextResponse.json({ error: 'invalid_country' }, { status: 400 })
    }
    if (!cidadeRaw) {
      return NextResponse.json({ error: 'invalid_city' }, { status: 400 })
    }
    if (body.aceitePoliticas !== true) {
      return NextResponse.json({ error: 'policies' }, { status: 400 })
    }

    const { data: uCheck } = await admin
      .from('turistas')
      .select('id')
      .eq('nome_usuario', nomeUsuario)
      .limit(1)
    const { data: pCheck } = await admin
      .from('profissionais')
      .select('id')
      .eq('nome_usuario', nomeUsuario)
      .limit(1)
    const { data: eCheck } = await admin.from('empresas').select('id').eq('nome_usuario', nomeUsuario).limit(1)
    if ((uCheck?.length ?? 0) + (pCheck?.length ?? 0) + (eCheck?.length ?? 0) > 0) {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }

    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { role: 'profissional' },
    })
    if (cuErr) {
      const msg = (cuErr.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'email_exists' }, { status: 409 })
      }
      if (msg.includes('database error')) {
        console.error('[cadastro/profissional] createUser:', cuErr.message)
        return NextResponse.json({ error: 'auth_database_error' }, { status: 503 })
      }
      return NextResponse.json({ error: cuErr.message }, { status: 400 })
    }

    const userId = created.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'no_user' }, { status: 500 })
    }

    const upsertUsuario = await admin.from('usuarios').upsert(
      { id: userId, email, role: 'profissional', status: 'pre_aprovado' },
      { onConflict: 'id' }
    )
    if (upsertUsuario.error) {
      try {
        await admin.auth.admin.deleteUser(userId)
      } catch {
        /* ignore */
      }
      return NextResponse.json({ error: upsertUsuario.error.message }, { status: 500 })
    }

    const placaVermelha = PLACA_CATEGORIAS.has(categoria)
    const cidadeAtuacao = [cidadeRaw]

    const payload: Record<string, unknown> = {
      usuario_id: userId,
      nome_completo: nomeCompleto,
      nome_usuario: nomeUsuario,
      categorias: [categoria],
      placa_vermelha: placaVermelha,
      pais,
      cidade_atuacao: cidadeAtuacao,
      status: 'pendente',
    }

    let ins = await admin.from('profissionais').insert(payload)
    if (ins.error && ins.error.message.toLowerCase().includes('pais')) {
      const rest = { ...payload }
      delete rest.pais
      delete rest.cidade_atuacao
      ins = await admin.from('profissionais').insert(rest)
    }
    if (ins.error && ins.error.message.toLowerCase().includes('status')) {
      const rest = { ...payload }
      delete rest.status
      ins = await admin.from('profissionais').insert(rest)
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
