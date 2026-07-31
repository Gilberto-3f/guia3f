import { NextRequest, NextResponse } from 'next/server'
import {
  createAuthUserForCadastro,
  upsertUsuarioCadastro,
} from '@/lib/cadastroCreateAuthUser'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { ehCategoriaEmpresaPermitida } from '@/lib/segmentosEmpresaGuia'
import {
  forwardGeocodeMapbox,
  montarQueryEnderecoEmpresa,
} from '@/lib/mapboxForwardGeocode'

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

function isMissingColumnError(e: { message?: string; code?: string } | null | undefined): boolean {
  if (!e) return false
  if (e.code === 'PGRST204') return true
  const msg = String(e.message ?? '').toLowerCase()
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache'))
}

function missingColumnFromError(e: { message?: string } | null | undefined): string | null {
  const msg = String(e?.message ?? '')
  const quoted = msg.match(/'([^']+)'\s+column/i) ?? msg.match(/column\s+'([^']+)'/i)
  return quoted?.[1] ?? null
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
    const authResult = await createAuthUserForCadastro(admin, {
      email,
      password,
      role: 'empresa',
    })
    if (!authResult.ok) {
      if (authResult.kind === 'email_exists') {
        return NextResponse.json({ error: 'email_exists', step, details: { message: authResult.error } }, { status: 409 })
      }
      if (authResult.kind === 'auth_database_error') {
        return NextResponse.json(
          { error: 'auth_database_error', step, details: { message: authResult.error } },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'Erro ao criar usuário', step, details: { message: authResult.error } }, { status: 500 })
    }

    createdUserId = authResult.user.id

    step = 'insertUsuario'
    const { error: usuarioErr } = await upsertUsuarioCadastro(admin, {
      id: createdUserId,
      email,
      role: 'empresa',
    })
    if (usuarioErr) {
      try {
        step = 'rollbackDeleteUser'
        await admin.auth.admin.deleteUser(createdUserId)
      } catch (rbErr) {
        return NextResponse.json(
          {
            error: 'Erro ao inserir usuário + rollback falhou',
            step,
            details: { insert: usuarioErr, rollback: errDetails(rbErr) },
            createdUserId,
          },
          { status: 500 },
        )
      }
      return NextResponse.json(
        { error: 'Erro ao inserir usuário', step: 'insertUsuario', details: { message: usuarioErr }, createdUserId },
        { status: 500 },
      )
    }

    const geo = await forwardGeocodeMapbox(
      montarQueryEnderecoEmpresa({
        endereco,
        bairro: enderecoBairro,
        cidade,
      }),
    )

    const payloadCompleto: Record<string, unknown> = {
      usuario_id: createdUserId,
      nome_fantasia: nomeFantasia,
      nome_usuario: nomeUsuario,
      categoria,
      cidade,
      endereco,
      bairro: enderecoBairro,
      whatsapp: whatsApp,
      descricao_curta: '',
      latitude: geo?.lat ?? null,
      longitude: geo?.lng ?? null,
      status: 'aguardando_aprovacao',
    }

    step = 'insertEmpresa'
    let payloadInsert: Record<string, unknown> = { ...payloadCompleto }
    let insertEmpresa = await admin.from('empresas').insert(payloadInsert)

    for (let tentativa = 0; tentativa < 6 && insertEmpresa.error && isMissingColumnError(insertEmpresa.error); tentativa++) {
      const col = missingColumnFromError(insertEmpresa.error)
      if (col && col in payloadInsert) {
        const { [col]: _omit, ...rest } = payloadInsert
        payloadInsert = rest
      } else if (tentativa === 0) {
        payloadInsert = {
          usuario_id: createdUserId,
          nome_fantasia: nomeFantasia,
          nome_usuario: nomeUsuario,
          categoria,
          cidade,
          endereco,
          bairro: enderecoBairro,
          whatsapp: whatsApp,
          descricao_curta: '',
          status: 'aguardando_aprovacao',
        }
      } else {
        break
      }
      insertEmpresa = await admin.from('empresas').insert(payloadInsert)
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
