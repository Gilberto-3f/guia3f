import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  CATEGORIA_EMPRESA_AGENCIA_GUIA,
  categoriasIncluemGuia,
} from '@/lib/guiaDualMode'
import { assertUserSession } from '@/lib/apiUserSession'

const usernameRegex = /^[a-z0-9._]{3,20}$/

export async function POST(req: NextRequest) {
  try {
    const session = await assertUserSession()
    if (!session.ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const userId = session.userId

    const admin = createSupabaseAdmin()
    const body = await req.json()
    const nomeFantasia = String(body.nomeFantasia ?? '').trim()
    const nomeUsuario = String(body.nomeUsuario ?? '')
      .trim()
      .toLowerCase()
      .replace(/^@+/, '')
    const cidade = String(body.cidade ?? '').trim()
    const endereco = String(body.endereco ?? '').trim()
    const bairro = String(body.bairro ?? '').trim()
    const whatsapp = String(body.whatsapp ?? '').trim()
    const descricaoCurta = String(body.descricaoCurta ?? '').trim()

    if (!nomeFantasia || !usernameRegex.test(nomeUsuario) || !cidade || !endereco || !whatsapp) {
      return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
    }

    const { data: prof } = await admin
      .from('profissionais')
      .select('id, categorias, empresa_agencia_id')
      .eq('usuario_id', userId)
      .maybeSingle()

    if (!prof?.id) {
      return NextResponse.json({ error: 'not_professional' }, { status: 403 })
    }

    const cats = Array.isArray(prof.categorias)
      ? prof.categorias.filter((c): c is string => typeof c === 'string')
      : []
    if (!categoriasIncluemGuia(cats)) {
      return NextResponse.json({ error: 'not_guia' }, { status: 403 })
    }

    if (prof.empresa_agencia_id) {
      return NextResponse.json({ error: 'already_registered' }, { status: 409 })
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

    const { data: empresa, error: empErr } = await admin
      .from('empresas')
      .insert({
        usuario_id: userId,
        profissional_vinculado_id: String(prof.id),
        somente_guia: true,
        nome_fantasia: nomeFantasia,
        nome_usuario: nomeUsuario,
        categoria: CATEGORIA_EMPRESA_AGENCIA_GUIA,
        cidade,
        endereco,
        bairro: bairro || null,
        whatsapp,
        descricao_curta: descricaoCurta || null,
        plano: 'gratuito',
        status: 'aguardando_aprovacao',
      })
      .select('id')
      .single()

    if (empErr || !empresa?.id) {
      return NextResponse.json({ error: empErr?.message ?? 'insert_failed' }, { status: 500 })
    }

    const empresaId = String(empresa.id)
    const { error: linkErr } = await admin
      .from('profissionais')
      .update({ empresa_agencia_id: empresaId })
      .eq('id', prof.id)

    if (linkErr) {
      await admin.from('empresas').delete().eq('id', empresaId)
      return NextResponse.json({ error: linkErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, empresaId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'server_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
