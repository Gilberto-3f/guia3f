import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const usernameRegex = /^[a-z0-9._]{3,20}$/

const PLACA_CATEGORIAS = new Set(['Guia', 'Taxista', 'Van'])

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
    const nomeCompleto = String(form.get('nomeCompleto') || '').trim()
    const nomeUsuario = String(form.get('nomeUsuario') || '').trim().toLowerCase().replace(/^@+/, '')
    const categoria = String(form.get('categoria') || '').trim()
    const pais = String(form.get('pais') || '').trim()
    const cidadeRaw = String(form.get('cidadeAtuacao') || '').trim()

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
    if (form.get('aceitePoliticas') !== 'true') {
      return NextResponse.json({ error: 'policies' }, { status: 400 })
    }

    const identidadeFrente = form.get('identidadeFrente')
    const identidadeVerso = form.get('identidadeVerso')
    const comprovanteResidencia = form.get('comprovanteResidencia')
    const comprovanteProfissao = form.get('comprovanteProfissao')
    const fotoPerfil = form.get('fotoPerfil')

    if (
      !(identidadeFrente instanceof File) ||
      identidadeFrente.size === 0 ||
      !(identidadeVerso instanceof File) ||
      identidadeVerso.size === 0
    ) {
      return NextResponse.json({ error: 'id_docs_required' }, { status: 400 })
    }
    if (!(comprovanteResidencia instanceof File) || comprovanteResidencia.size === 0) {
      return NextResponse.json({ error: 'address_proof_required' }, { status: 400 })
    }
    if (!(comprovanteProfissao instanceof File) || comprovanteProfissao.size === 0) {
      return NextResponse.json({ error: 'profession_proof_required' }, { status: 400 })
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
      return NextResponse.json({ error: cuErr.message }, { status: 400 })
    }

    const userId = created.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'no_user' }, { status: 500 })
    }

    const idFrenteUrl = await uploadFile(admin, 'documentos', 'documentos', userId, identidadeFrente)
    const idVersoUrl = await uploadFile(admin, 'documentos', 'documentos', userId, identidadeVerso)
    const resUrl = await uploadFile(admin, 'documentos', 'documentos', userId, comprovanteResidencia)
    const profUrl = await uploadFile(admin, 'documentos', 'documentos', userId, comprovanteProfissao)

    let fotoUrl: string | null = null
    if (fotoPerfil instanceof File && fotoPerfil.size > 0) {
      fotoUrl = await uploadFile(admin, 'documentos', 'foto-perfil', userId, fotoPerfil)
    }

    const placaVermelha = PLACA_CATEGORIAS.has(categoria)
    const cidadeAtuacao = [cidadeRaw]

    const payload: Record<string, unknown> = {
      usuario_id: userId,
      nome_completo: nomeCompleto,
      nome_usuario: nomeUsuario,
      categorias: [categoria],
      placa_vermelha: placaVermelha,
      identidade_url: idFrenteUrl,
      documento_verso_url: idVersoUrl,
      comprovante_residencia_url: resUrl,
      comprovante_profissao_url: profUrl,
      pais,
      cidade_atuacao: cidadeAtuacao,
      status: 'pendente',
    }
    if (fotoUrl) payload.foto_perfil_url = fotoUrl

    let ins = await admin.from('profissionais').insert(payload)
    if (ins.error && fotoUrl && ins.error.message.toLowerCase().includes('foto_perfil')) {
      const { foto_perfil_url: _f, ...rest } = payload
      ins = await admin.from('profissionais').insert(rest)
    }
    if (ins.error && ins.error.message.toLowerCase().includes('documento_verso')) {
      const { documento_verso_url: _d, ...rest } = payload
      rest.identidade_url = idFrenteUrl
      ins = await admin.from('profissionais').insert(rest)
    }
    if (ins.error && ins.error.message.toLowerCase().includes('pais')) {
      const { pais: _p, cidade_atuacao: _c, ...rest } = payload
      ins = await admin.from('profissionais').insert(rest)
    }
    if (ins.error && ins.error.message.toLowerCase().includes('status')) {
      const { status: _s, ...rest } = payload
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
