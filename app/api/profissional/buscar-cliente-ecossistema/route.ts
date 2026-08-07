import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export type ClienteEcossistemaRow = {
  usuario_id: string
  nome: string
  username: string | null
  foto_url: string | null
}

/**
 * Busca turistas por nome social ou @username (recomendação direcionada Ecossistema).
 */
export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error
  if (auth.role !== 'profissional' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas profissionais.' }, { status: 403 })
  }

  const q = String(new URL(req.url).searchParams.get('q') ?? '')
    .trim()
    .replace(/^@+/, '')
  if (q.length < 2) {
    return NextResponse.json({ clientes: [] as ClienteEcossistemaRow[] })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const pattern = `%${q}%`
  const [porUser, porNome] = await Promise.all([
    admin
      .from('turistas')
      .select('usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url')
      .ilike('nome_usuario', pattern)
      .limit(25),
    admin
      .from('turistas')
      .select('usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url')
      .ilike('nome_completo', pattern)
      .limit(25),
  ])

  if (porUser.error || porNome.error) {
    return NextResponse.json(
      { error: porUser.error?.message ?? porNome.error?.message ?? 'Falha na busca.' },
      { status: 500 },
    )
  }

  const map = new Map<string, ClienteEcossistemaRow>()
  for (const t of [...(porUser.data ?? []), ...(porNome.data ?? [])]) {
    const uid = String(t.usuario_id)
    if (map.has(uid)) continue
    const foto =
      t.foto_perfil_url != null && String(t.foto_perfil_url).trim()
        ? String(t.foto_perfil_url)
        : t.foto_url != null && String(t.foto_url).trim()
          ? String(t.foto_url)
          : null
    map.set(uid, {
      usuario_id: uid,
      nome: String(t.nome_completo ?? 'Turista'),
      username: t.nome_usuario != null ? String(t.nome_usuario).replace(/^@+/, '') : null,
      foto_url: foto,
    })
  }

  return NextResponse.json({ clientes: [...map.values()].slice(0, 20) })
}
