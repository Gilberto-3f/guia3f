import { listarEmpresaIdsFavoritasPorUsuario } from '@/lib/favoritosEmpresa'

const SEM_PRAZO_DATA = '2099-12-31'

const SLUG_PARA_OFERTA_CATEGORIA = {
  motorista_app: 'Motorista de APP',
  guia: 'Guia de Turismo',
  van: 'Motorista de Van',
  taxista: 'Taxista',
  anfitriao: 'Anfitrião',
  anfitrião: 'Anfitrião',
}

/** @type {Map<string, { payload: ComissoesOfertasPayload, ts: number }>} */
const cache = new Map()
const CACHE_MS = 90_000

/**
 * @typedef {{
 *   ofertas: Array<Record<string, unknown>>
 *   favoritosEmpresaIds: string[]
 *   semComunidade: boolean
 *   erro: string | null
 * }} ComissoesOfertasPayload
 */

function ofertaVigente(oferta) {
  const raw = oferta.beneficios
  const b =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? /** @type {{ por_tempo_limitado?: boolean }} */ (raw)
      : {}
  if (b.por_tempo_limitado !== true) return true
  const data = oferta.data_validade ? String(oferta.data_validade).slice(0, 10) : ''
  if (!data || data === SEM_PRAZO_DATA) return true
  const hoje = new Date().toISOString().slice(0, 10)
  return data >= hoje
}

function deduplicarOfertas(rows) {
  const vistos = new Set()
  const dedup = []
  for (const row of rows ?? []) {
    const empId = String(row.empresa_id ?? '')
    if (!empId || vistos.has(empId)) continue
    if (!ofertaVigente(row)) continue
    vistos.add(empId)
    dedup.push(row)
  }
  return dedup
}

function categoriasOfertaFromProf(prof) {
  const slugs = Array.isArray(prof?.categorias) ? prof.categorias.map((c) => String(c).toLowerCase()) : []
  return [
    ...new Set(
      slugs
        .map((s) => SLUG_PARA_OFERTA_CATEGORIA[/** @type {keyof typeof SLUG_PARA_OFERTA_CATEGORIA} */ (s)])
        .filter(Boolean)
    ),
  ]
}

/**
 * @param {string} usuarioId
 * @returns {ComissoesOfertasPayload | null}
 */
export function getComissoesOfertasCache(usuarioId) {
  const hit = cache.get(usuarioId)
  if (!hit || Date.now() - hit.ts >= CACHE_MS) return null
  return hit.payload
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} usuarioId
 * @param {{ skipCache?: boolean }} [opts]
 * @returns {Promise<ComissoesOfertasPayload>}
 */
export async function fetchComissoesOfertasData(supabase, usuarioId, opts = {}) {
  const hit = cache.get(usuarioId)
  if (!opts.skipCache && hit && Date.now() - hit.ts < CACHE_MS) {
    return hit.payload
  }

  const [profRes, favIds] = await Promise.all([
    supabase.from('profissionais').select('categorias').eq('usuario_id', usuarioId).maybeSingle(),
    listarEmpresaIdsFavoritasPorUsuario(supabase, usuarioId).catch(() => []),
  ])

  const categoriasOferta = categoriasOfertaFromProf(profRes.data)

  if (categoriasOferta.length === 0) {
    const payload = {
      ofertas: [],
      favoritosEmpresaIds: favIds,
      semComunidade: true,
      erro: null,
    }
    cache.set(usuarioId, { payload, ts: Date.now() })
    return payload
  }

  const { data, error } = await supabase
    .from('comissao_oferta')
    .select(
      `
        id,
        empresa_id,
        categoria_profissional,
        beneficios,
        data_validade,
        created_at,
        empresas (
          id,
          nome_fantasia,
          nome_usuario,
          foto_url,
          cidade,
          categoria
        )
      `
    )
    .eq('status', 'aprovada')
    .in('categoria_profissional', categoriasOferta)
    .order('created_at', { ascending: false })

  if (error) {
    const payload = {
      ofertas: [],
      favoritosEmpresaIds: favIds,
      semComunidade: false,
      erro: 'Não foi possível carregar as ofertas de comissão.',
    }
    return payload
  }

  const payload = {
    ofertas: deduplicarOfertas(data),
    favoritosEmpresaIds: favIds,
    semComunidade: false,
    erro: null,
  }
  cache.set(usuarioId, { payload, ts: Date.now() })
  return payload
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string | null | undefined} usuarioId
 */
export function prefetchComissoesOfertas(supabase, usuarioId) {
  if (!usuarioId) return
  void fetchComissoesOfertasData(supabase, usuarioId).catch(() => {})
}

/**
 * @param {string} usuarioId
 */
export function invalidarCacheComissoesOfertas(usuarioId) {
  if (usuarioId) cache.delete(usuarioId)
}
