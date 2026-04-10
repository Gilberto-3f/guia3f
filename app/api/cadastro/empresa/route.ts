import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const usernameRegex = /^[a-z0-9._]{3,20}$/
const minimoFotos = 3
const maxDescricao = 170

async function uploadFile(
  admin: ReturnType<typeof createSupabaseAdmin>,
  bucket: string,
  folder: string,
  userId: string,
  file: File
) {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  const { error } = await admin.storage.from(bucket).upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  const { data } = admin.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function POST(req: NextRequest) {
  try {
    const admin = createSupabaseAdmin()
    const form = await req.formData()

    const email = String(form.get('email') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    const nomeFantasia = String(form.get('nomeFantasia') || '').trim()
    const nomeUsuario = String(form.get('nomeUsuario') || '').trim().toLowerCase().replace(/^@+/, '')
    const categoria = String(form.get('categoria') || '').trim()
    const cidade = String(form.get('cidade') || '').trim()
    const enderecoCompleto = String(form.get('enderecoCompleto') || '').trim()
    const telefone = String(form.get('telefone') || '').trim()
    const whatsApp = String(form.get('whatsApp') || '').trim()
    const descricaoCurta = String(form.get('descricaoCurta') || '').trim()
    const website = String(form.get('website') || '').trim()
    const horariosJson = String(form.get('horarios') || '[]')

    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }
    if (!senhaRegex.test(password)) {
      return NextResponse.json({ error: 'invalid_password' }, { status: 400 })
    }
    if (!nomeFantasia || !usernameRegex.test(nomeUsuario)) {
      return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
    }
    if (!categoria || !cidade || !enderecoCompleto) {
      return NextResponse.json({ error: 'invalid_location' }, { status: 400 })
    }
    if (!telefone || !whatsApp) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 })
    }
    if (!descricaoCurta || descricaoCurta.length > maxDescricao) {
      return NextResponse.json({ error: 'invalid_description' }, { status: 400 })
    }
    if (form.get('aceitePoliticas') !== 'true') {
      return NextResponse.json({ error: 'policies' }, { status: 400 })
    }

    let horariosSelecionados: string[] = []
    try {
      const parsed = JSON.parse(horariosJson)
      if (Array.isArray(parsed)) horariosSelecionados = parsed.map(String)
    } catch {
      return NextResponse.json({ error: 'invalid_hours' }, { status: 400 })
    }

    const documentoComercial = form.get('documentoComercial')
    if (!(documentoComercial instanceof File) || documentoComercial.size === 0) {
      return NextResponse.json({ error: 'doc_required' }, { status: 400 })
    }

    const fotos = form.getAll('fotos').filter((f): f is File => f instanceof File && f.size > 0)
    if (fotos.length < minimoFotos) {
      return NextResponse.json({ error: 'photos_min' }, { status: 400 })
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

    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { role: 'empresa' },
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

    const logo = form.get('logo')
    let logoUrl: string | null = null
    if (logo instanceof File && logo.size > 0) {
      logoUrl = await uploadFile(admin, 'empresas', 'logos', userId, logo)
    }

    const fotosUrls: string[] = []
    for (const f of fotos) {
      fotosUrls.push(await uploadFile(admin, 'empresas', 'fotos', userId, f))
    }

    const documentoComercialUrl = await uploadFile(admin, 'documentos', 'empresa-documentos', userId, documentoComercial)

    const geo = { status: 'pendente', latitude: null as number | null, longitude: null as number | null }

    const payloadCompleto: Record<string, unknown> = {
      usuario_id: userId,
      nome_fantasia: nomeFantasia,
      nome_usuario: nomeUsuario,
      categoria,
      cidade,
      endereco: enderecoCompleto,
      telefone,
      whatsapp: whatsApp,
      descricao_curta: descricaoCurta,
      horarios_funcionamento: horariosSelecionados,
      fotos_urls: fotosUrls,
      documento_comercial_url: documentoComercialUrl,
      geocoding_status: geo.status,
      latitude: geo.latitude,
      longitude: geo.longitude,
      status: 'aguardando_aprovacao',
    }
    if (website) payloadCompleto.website = website
    if (logoUrl) payloadCompleto.logo_url = logoUrl

    let insertEmpresa = await admin.from('empresas').insert(payloadCompleto)
    if (
      insertEmpresa.error &&
      insertEmpresa.error.message.toLowerCase().includes('column') &&
      insertEmpresa.error.message.toLowerCase().includes('does not exist')
    ) {
      const payloadMinimo = {
        usuario_id: userId,
        nome_fantasia: nomeFantasia,
        nome_usuario: nomeUsuario,
        categoria,
        cidade,
        endereco: enderecoCompleto,
        descricao_curta: descricaoCurta,
        status: 'aguardando_aprovacao',
      }
      insertEmpresa = await admin.from('empresas').insert(payloadMinimo)
    }
    if (insertEmpresa.error && insertEmpresa.error.message.toLowerCase().includes('status')) {
      const { status: _s, ...rest } = payloadCompleto
      insertEmpresa = await admin.from('empresas').insert(rest)
    }
    if (insertEmpresa.error && insertEmpresa.error.message.toLowerCase().includes('website')) {
      const { website: _w, ...rest } = payloadCompleto
      insertEmpresa = await admin.from('empresas').insert(rest)
    }

    if (insertEmpresa.error) {
      try {
        await admin.auth.admin.deleteUser(userId)
      } catch {
        /* ignore */
      }
      return NextResponse.json({ error: insertEmpresa.error.message }, { status: 500 })
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
