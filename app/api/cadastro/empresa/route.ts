import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { ehCategoriaEmpresaPermitida } from '@/lib/segmentosEmpresaGuia'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const usernameRegex = /^[a-z0-9._]{3,20}$/

function errDetails(err: unknown) {
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack?.slice(0, 500) }
  }
  try {
    return { message: JSON.stringify(err)?.slice(0, 1000) }
  } catch {
    return { message: String(err) }
  }
}

function safeSupabaseError(e: any) {
  return {
    message: e?.message,
    code: e?.code,
    hint: e?.hint,
    details: e?.details,
    status: e?.status,
  }
}

export async function POST(req: NextRequest) {
  let step = 'init'
  let createdUserId: string | null = null
  try {
    step = 'createSupabaseAdmin'
    const admin = createSupabaseAdmin()
    step = 'parseFormData'
    const form = await req.formData()

    step = 'validations'
    const email = String(form.get('email') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    const nomeFantasia = String(form.get('nomeFantasia') || '').trim()
    const nomeUsuario = String(form.get('nomeUsuario') || '').trim().toLowerCase().replace(/^@+/, '')
    const categoria = String(form.get('categoria') || '').trim()
    if (!ehCategoriaEmpresaPermitida(categoria)) {
      return NextResponse.json({ error: 'invalid_category' }, { status: 400 })
    }
    const cidade = String(form.get('cidade') || '').trim()
    const enderecoRua = String(form.get('enderecoRua') || '').trim()
    const enderecoNumero = String(form.get('enderecoNumero') || '').trim()
    const enderecoBairro = String(form.get('enderecoBairro') || '').trim()
    const whatsApp = String(form.get('whatsApp') || '').trim()

    const endereco = enderecoNumero ? `${enderecoRua}, ${enderecoNumero}` : enderecoRua

    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }
    if (!senhaRegex.test(password)) {
      return NextResponse.json({ error: 'invalid_password' }, { status: 400 })
    }
    if (!nomeFantasia || !usernameRegex.test(nomeUsuario)) {
      return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
    }
    if (!categoria || !cidade || !enderecoRua || !enderecoNumero || !enderecoBairro) {
      return NextResponse.json({ error: 'invalid_location' }, { status: 400 })
    }
    if (!whatsApp) {
      return NextResponse.json({ error: 'invalid_whatsapp' }, { status: 400 })
    }
    if (form.get('aceitePoliticas') !== 'true') {
      return NextResponse.json({ error: 'policies' }, { status: 400 })
    }

    step = 'usernameChecks'
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

    step = 'createUser'
    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'empresa' },
    })
    if (cuErr) {
      const msg = (cuErr.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'email_exists', step, details: safeSupabaseError(cuErr) }, { status: 409 })
      }
      return NextResponse.json({ error: 'Erro ao criar usuário', step, details: safeSupabaseError(cuErr) }, { status: 500 })
    }

    createdUserId = created.user?.id ?? null
    if (!createdUserId) {
      return NextResponse.json({ error: 'no_user', step, details: { created } }, { status: 500 })
    }

    const geo = { status: 'pendente', latitude: null as number | null, longitude: null as number | null }

    const payloadCompleto: Record<string, unknown> = {
      usuario_id: createdUserId,
      nome_fantasia: nomeFantasia,
      nome_usuario: nomeUsuario,
      categoria,
      cidade,
      endereco,
      bairro: enderecoBairro,
      whatsapp: whatsApp,
      geocoding_status: geo.status,
      latitude: geo.latitude,
      longitude: geo.longitude,
      status: 'aguardando_aprovacao',
    }

    step = 'insertEmpresa'
    let insertEmpresa = await admin.from('empresas').insert(payloadCompleto)
    if (
      insertEmpresa.error &&
      insertEmpresa.error.message.toLowerCase().includes('column') &&
      insertEmpresa.error.message.toLowerCase().includes('does not exist')
    ) {
      const payloadMinimo = {
        usuario_id: createdUserId,
        nome_fantasia: nomeFantasia,
        nome_usuario: nomeUsuario,
        categoria,
        cidade,
        endereco,
        status: 'aguardando_aprovacao',
      }
      insertEmpresa = await admin.from('empresas').insert(payloadMinimo)
    }
    if (insertEmpresa.error && insertEmpresa.error.message.toLowerCase().includes('status')) {
      const { status: _s, ...rest } = payloadCompleto
      insertEmpresa = await admin.from('empresas').insert(rest)
    }
    if (insertEmpresa.error && insertEmpresa.error.message.toLowerCase().includes('bairro')) {
      const { bairro: _b, ...rest } = payloadCompleto
      insertEmpresa = await admin.from('empresas').insert(rest)
    }

    if (insertEmpresa.error) {
      const insertErr = insertEmpresa.error
      try {
        step = 'rollbackDeleteUser'
        await admin.auth.admin.deleteUser(createdUserId)
      } catch (rbErr) {
        return NextResponse.json(
          {
            error: 'Erro ao inserir empresa + rollback falhou',
            step,
            details: { insert: safeSupabaseError(insertErr), rollback: errDetails(rbErr) },
            createdUserId,
          },
          { status: 500 }
        )
      }
      return NextResponse.json(
        { error: 'Erro ao inserir empresa', step: 'insertEmpresa', details: safeSupabaseError(insertErr), createdUserId },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, step: 'complete' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('em falta')) {
      return NextResponse.json({ error: 'server_config', step, details: errDetails(e), createdUserId }, { status: 503 })
    }
    return NextResponse.json({ error: 'Erro interno', step, details: errDetails(e), createdUserId }, { status: 500 })
  }
}
