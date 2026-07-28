import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Contagem de visualizações (usuários alcançados) de um post do feed. */
export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const postId = String(url.searchParams.get('post_id') ?? '').trim()
  if (!postId) {
    return NextResponse.json({ error: 'post_id obrigatório.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { count, error } = await admin
    .from('feed_visualizacao')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, visualizacoes: count ?? 0 })
}
