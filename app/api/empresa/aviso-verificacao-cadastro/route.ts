import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { enviarAvisoVerificacaoCadastroMensageiroEco } from '@/lib/mensageiroAdm'

/** Empresa enviou documentos: avisa ADM no Mensageiro ECOSSISTEMA do bloco. */
export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const empresaId = String(body.empresa_id ?? '').trim()
    if (!empresaId) {
      return NextResponse.json({ error: 'empresa_id é obrigatório.' }, { status: 400 })
    }

    const res = await enviarAvisoVerificacaoCadastroMensageiroEco(session.supabase, {
      empresaId,
      usuarioId: session.userId,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Não foi possível avisar o ADM.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
