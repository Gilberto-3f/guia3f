import { NextResponse } from 'next/server'
import { assertUserSessionLight } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { backfillCoordsEmpresas } from '@/lib/empresaCoordsBackfill'
import { buscarIdsEmpresaPresencaPublicaVigente, invalidarCachePresencaPublicaGlobal } from '@/lib/empresaPresencaPublica'

const CHUNK = 80
const MAX_POR_REQUEST = 200
const CONCURRENCY = 8

/**
 * POST — geocodifica e persiste lat/lng de empresas com presença pública sem coords.
 * Qualquer sessão autenticada (mesmo critério do mapa). Pode ser chamado várias vezes
 * até remaining=0 (contas antigas / CDE / agências dual).
 */
export async function POST() {
  const auth = await assertUserSessionLight()
  if (!auth.ok) return auth.error

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const idsSet = await buscarIdsEmpresaPresencaPublicaVigente(admin)
  const ids = [...idsSet]
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, repaired: 0, remaining: 0, totalPresenca: 0 })
  }

  const semCoords: {
    id: string
    endereco: string | null
    bairro: string | null
    cidade: string | null
  }[] = []

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { data, error } = await admin
      .from('empresas')
      .select('id, endereco, bairro, cidade, latitude, longitude, foto_url')
      .in('id', slice)
      .not('foto_url', 'is', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const lat = Number(row.latitude)
      const lng = Number(row.longitude)
      if (Number.isFinite(lat) && Number.isFinite(lng)) continue
      const id = String(row.id ?? '')
      if (!id) continue
      semCoords.push({
        id,
        endereco: row.endereco != null ? String(row.endereco) : null,
        bairro: row.bairro != null ? String(row.bairro) : null,
        cidade: row.cidade != null ? String(row.cidade) : null,
      })
    }
  }

  if (semCoords.length === 0) {
    return NextResponse.json({
      ok: true,
      repaired: 0,
      remaining: 0,
      totalPresenca: ids.length,
    })
  }

  // Prioriza CDE + Serviços Locais (agências dual) e quem tem endereço.
  const prioridade = (r: (typeof semCoords)[number]) => {
    const cidade = String(r.cidade ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    let score = 0
    if (cidade.includes('este') || cidade.includes('cde') || cidade.includes('leste')) score += 3
    if (r.endereco) score += 2
    if (r.cidade) score += 1
    return score
  }
  semCoords.sort((a, b) => prioridade(b) - prioridade(a))

  const preenchidos = await backfillCoordsEmpresas(admin, semCoords, {
    maxPorRequest: MAX_POR_REQUEST,
    concurrency: CONCURRENCY,
  })

  if (preenchidos.size > 0) {
    invalidarCachePresencaPublicaGlobal()
  }

  const remaining = Math.max(0, semCoords.length - preenchidos.size)

  return NextResponse.json({
    ok: true,
    repaired: preenchidos.size,
    remaining,
    totalPresenca: ids.length,
    pendingKnown: semCoords.length,
  })
}
