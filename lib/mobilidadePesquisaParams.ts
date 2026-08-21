/** Query params da pesquisa de mobilidade (Etapa 1 → /mobilidade). */

export type MobilidadePonto = {
  nome: string
  lat: number | null
  lng: number | null
}

/** Como o turista chegou nos drawers de mobilidade. */
export type MobilidadeContratacaoModo = 'algoritmo' | 'particular' | 'recomendacao'

export type MobilidadePesquisaState = {
  origem: MobilidadePonto
  destino: MobilidadePonto
  destinoEmpresaId: string | null
  /** Abre o popup de pesquisa na Etapa 3. */
  abrirPesquisa: boolean
  /** Indicação: recomendacoes_profissional.id */
  recomendacaoId: string | null
  /** Indicação / contratar: usuarios.id do profissional */
  profissionalUsuarioId: string | null
  /** Rota de contratação (explícita na URL; fallback pelos ids). */
  modo: MobilidadeContratacaoModo
}

function numOrNull(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function pontoPreenchido(p: MobilidadePonto): boolean {
  const nome = String(p.nome ?? '').trim()
  if (nome) return true
  return pontoComCoords(p)
}

/** GPS / mapa: precisa de lat e lng válidos (nome sozinho não basta). */
export function pontoComCoords(p: {
  lat: number | null | undefined
  lng: number | null | undefined
}): boolean {
  return p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)
}

export function resolverModoContratacaoMobilidade(params: {
  modo?: string | null
  profissionalUsuarioId?: string | null
  recomendacaoId?: string | null
}): MobilidadeContratacaoModo {
  const raw = String(params.modo ?? '').trim().toLowerCase()
  if (raw === 'particular' || raw === 'recomendacao' || raw === 'algoritmo') return raw
  if (String(params.recomendacaoId ?? '').trim()) return 'recomendacao'
  if (String(params.profissionalUsuarioId ?? '').trim()) return 'particular'
  return 'algoritmo'
}

/** Particular (cartão) ou recomendação: profissional já escolhido, sem matching da home. */
export function ehContratacaoDirigida(pesquisa: {
  modo?: MobilidadeContratacaoModo | string | null
  profissionalUsuarioId?: string | null
  recomendacaoId?: string | null
}): boolean {
  const modo = resolverModoContratacaoMobilidade(pesquisa)
  return modo === 'particular' || modo === 'recomendacao'
}

function appendNoncePesquisa(href: string): string {
  const sep = href.includes('?') ? '&' : '?'
  return `${href}${sep}_cc=${Date.now()}`
}

export function parseMobilidadePesquisaSearchParams(
  sp: URLSearchParams | { get: (k: string) => string | null },
): MobilidadePesquisaState {
  const destinoEmpresa = String(sp.get('destino_empresa') ?? '').trim()
  const destinoNome =
    String(sp.get('destino_nome') ?? sp.get('destino') ?? '').trim() ||
    (destinoEmpresa ? '' : '')
  const rec = String(sp.get('rec') ?? sp.get('recomendacao_id') ?? '').trim()
  const prof = String(
    sp.get('prof') ?? sp.get('contratar') ?? sp.get('profissional_usuario_id') ?? '',
  ).trim()
  return {
    origem: {
      nome: String(sp.get('origem_nome') ?? sp.get('origem') ?? '').trim(),
      lat: numOrNull(sp.get('origem_lat')),
      lng: numOrNull(sp.get('origem_lng')),
    },
    destino: {
      nome: destinoNome,
      lat: numOrNull(sp.get('destino_lat')),
      lng: numOrNull(sp.get('destino_lng')),
    },
    destinoEmpresaId: destinoEmpresa || null,
    abrirPesquisa: sp.get('abrir_pesquisa') === '1' || sp.get('pesquisar') === '1',
    recomendacaoId: rec || null,
    profissionalUsuarioId: prof || null,
    modo: resolverModoContratacaoMobilidade({
      modo: sp.get('modo'),
      profissionalUsuarioId: prof,
      recomendacaoId: rec,
    }),
  }
}

export function buildMobilidadePesquisaHref(params: {
  origem: MobilidadePonto
  destino: MobilidadePonto
  destinoEmpresaId?: string | null
  abrirPesquisa?: boolean
  recomendacaoId?: string | null
  profissionalUsuarioId?: string | null
  modo?: MobilidadeContratacaoModo | null
}): string {
  const q = new URLSearchParams()
  const oNome = String(params.origem.nome ?? '').trim()
  if (oNome) q.set('origem_nome', oNome)
  if (params.origem.lat != null && Number.isFinite(params.origem.lat)) {
    q.set('origem_lat', String(params.origem.lat))
  }
  if (params.origem.lng != null && Number.isFinite(params.origem.lng)) {
    q.set('origem_lng', String(params.origem.lng))
  }

  const dNome = String(params.destino.nome ?? '').trim()
  if (dNome) q.set('destino_nome', dNome)
  if (params.destino.lat != null && Number.isFinite(params.destino.lat)) {
    q.set('destino_lat', String(params.destino.lat))
  }
  if (params.destino.lng != null && Number.isFinite(params.destino.lng)) {
    q.set('destino_lng', String(params.destino.lng))
  }

  const emp = String(params.destinoEmpresaId ?? '').trim()
  if (emp) q.set('destino_empresa', emp)

  const rec = String(params.recomendacaoId ?? '').trim()
  if (rec) q.set('rec', rec)

  const prof = String(params.profissionalUsuarioId ?? '').trim()
  if (prof) q.set('prof', prof)

  if (params.abrirPesquisa === true) q.set('abrir_pesquisa', '1')

  const modo = resolverModoContratacaoMobilidade({
    modo: params.modo,
    profissionalUsuarioId: prof,
    recomendacaoId: rec,
  })
  if (params.abrirPesquisa === true || modo !== 'algoritmo') {
    q.set('modo', modo)
  }

  const qs = q.toString()
  return qs ? `/mobilidade?${qs}` : '/mobilidade'
}

/**
 * Cartão de visita / indicação: drawer dirigido, destino vazio, nonce anti-stale (Android).
 */
export function buildHrefContratarParticular(params: {
  profissionalUsuarioId: string
  recomendacaoId?: string | null
}): string {
  const rec = String(params.recomendacaoId ?? '').trim()
  const href = buildMobilidadePesquisaHref({
    origem: { nome: '', lat: null, lng: null },
    destino: { nome: '', lat: null, lng: null },
    destinoEmpresaId: null,
    abrirPesquisa: true,
    profissionalUsuarioId: params.profissionalUsuarioId,
    recomendacaoId: rec || null,
    modo: rec ? 'recomendacao' : 'particular',
  })
  return appendNoncePesquisa(href)
}

/**
 * Atalho "Chamar corrida": abre /mobilidade com drawer 1 e destino da empresa preenchido.
 */
export function buildHrefChamarCorridaEmpresa(params: {
  empresaId: string
  nomeDestino?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
}): string {
  const id = String(params.empresaId ?? '').trim()
  const lat = params.latitude != null && params.latitude !== '' ? Number(params.latitude) : NaN
  const lng = params.longitude != null && params.longitude !== '' ? Number(params.longitude) : NaN
  const href = buildMobilidadePesquisaHref({
    origem: { nome: '', lat: null, lng: null },
    destino: {
      nome: String(params.nomeDestino ?? '').trim(),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    },
    destinoEmpresaId: id || null,
    abrirPesquisa: true,
    modo: 'algoritmo',
  })
  return appendNoncePesquisa(href)
}
