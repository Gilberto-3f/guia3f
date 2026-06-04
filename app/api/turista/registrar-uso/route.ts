import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { registrarContratacaoPreLiberada } from '@/lib/turistaPreLiberacao'

export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const body = (await req.json()) as Record<string, unknown>
    const tipo = String(body.tipo ?? '').trim()
    const descricao = String(body.descricao ?? '').trim()
    const empresaId = body.empresa_id != null ? String(body.empresa_id) : null

    if (!tipo || !descricao) {
      return NextResponse.json({ error: 'params' }, { status: 400 })
    }

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }

    await registrarContratacaoPreLiberada(adminDb, session.userId, {
      tipo,
      descricao,
      empresa_id: empresaId,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
