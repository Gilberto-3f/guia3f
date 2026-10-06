import { NextResponse } from 'next/server'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'
import { persistirLeituraCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissionalLeitura.server'
import { assertUserSession } from '@/lib/apiUserSession'

/** Profissional (incl. anfitrião) marca aviso(s) do canal financeiro como lido(s). */
export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const role = String(session.role ?? '')
    if (role === 'turista' || role === 'admin') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { data: prof } = await session.supabase
      .from('profissionais')
      .select('id, categorias')
      .eq('usuario_id', session.userId)
      .maybeSingle()

    const profissionalId = prof?.id != null ? String(prof.id) : ''
    if (!profissionalId) {
      return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 404 })
    }

    const cats = Array.isArray(prof?.categorias)
      ? prof.categorias.filter((c): c is string => typeof c === 'string')
      : []
    const marcarManifestoLegado = categoriasIncluemAnfitriao(cats)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const itemId = String(body.item_id ?? '').trim() || undefined

    const ok = await persistirLeituraCanalFinanceiroProfissional(
      session.supabase,
      profissionalId,
      itemId,
      { marcarManifestoLegado },
    )
    if (!ok) {
      return NextResponse.json({ error: 'Não foi possível marcar como lido.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
