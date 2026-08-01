import { NextResponse } from 'next/server'
import { assertUserSessionLight } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { IDIOMAS_GUIA, normalizarIdiomasGuia } from '@/lib/idiomasGuia'
import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'

/**
 * Idiomas cadastrados por profissionais da categoria Guia (união real para o filtro).
 * GET /api/mobilidade/idiomas-guia
 */
export async function GET() {
  const auth = await assertUserSessionLight()
  if (!auth.ok) return auth.error

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.', idiomas: [] }, { status: 503 })
  }

  const { data, error } = await admin.from('profissionais').select('categorias, idiomas').limit(800)

  if (error) {
    return NextResponse.json(
      { error: error.message, idiomas: [] },
      { status: /timeout|57014|canceling/i.test(error.message) ? 503 : 400 },
    )
  }

  const set = new Set<string>()
  for (const row of data ?? []) {
    const cats = normalizarCategoriasProfissional(
      Array.isArray(row.categorias) ? (row.categorias as string[]) : null,
    )
    if (!cats.includes('guia')) continue
    for (const c of normalizarIdiomasGuia(row.idiomas)) set.add(c)
  }

  const idiomas = IDIOMAS_GUIA.filter((i) => set.has(i.codigo)).map((i) => ({
    codigo: i.codigo,
    label: i.label,
    bandeira: i.bandeira,
  }))

  return NextResponse.json(
    { ok: true, idiomas },
    {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    },
  )
}
