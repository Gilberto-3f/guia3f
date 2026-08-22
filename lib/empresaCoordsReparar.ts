import type { SupabaseClient } from '@supabase/supabase-js'
import { backfillCoordsEmpresas } from '@/lib/empresaCoordsBackfill'
import {
  buscarIdsEmpresaPresencaPublicaVigente,
  invalidarCachePresencaPublicaGlobal,
} from '@/lib/empresaPresencaPublica'

const CHUNK = 80
const MAX_POR_REQUEST = 200
const CONCURRENCY = 8

export type RepararCoordsResultado = {
  ok: true
  repaired: number
  remaining: number
  totalPresenca: number
  pendingKnown?: number
}

/**
 * Geocodifica e persiste lat/lng de empresas com presença pública sem coords.
 * Uso: cron / ADM — não expor no mapa público.
 */
export async function repararCoordsEmpresasPresencaPublica(
  admin: SupabaseClient,
): Promise<RepararCoordsResultado> {
  const idsSet = await buscarIdsEmpresaPresencaPublicaVigente(admin)
  const ids = [...idsSet]
  if (ids.length === 0) {
    return { ok: true, repaired: 0, remaining: 0, totalPresenca: 0 }
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
      throw new Error(error.message)
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
    return { ok: true, repaired: 0, remaining: 0, totalPresenca: ids.length }
  }

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

  return {
    ok: true,
    repaired: preenchidos.size,
    remaining,
    totalPresenca: ids.length,
    pendingKnown: semCoords.length,
  }
}
