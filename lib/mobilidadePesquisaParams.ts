/** Query params da pesquisa de mobilidade (Etapa 1 → /mobilidade). */

export type MobilidadePonto = {
  nome: string
  lat: number | null
  lng: number | null
}

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
}

function numOrNull(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function pontoPreenchido(p: MobilidadePonto): boolean {
  const nome = String(p.nome ?? '').trim()
  if (nome) return true
  return p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)
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
  }
}

export function buildMobilidadePesquisaHref(params: {
  origem: MobilidadePonto
  destino: MobilidadePonto
  destinoEmpresaId?: string | null
  abrirPesquisa?: boolean
  recomendacaoId?: string | null
  profissionalUsuarioId?: string | null
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

  const qs = q.toString()
  return qs ? `/mobilidade?${qs}` : '/mobilidade'
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
  return buildMobilidadePesquisaHref({
    origem: { nome: '', lat: null, lng: null },
    destino: {
      nome: String(params.nomeDestino ?? '').trim(),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    },
    destinoEmpresaId: id || null,
    abrirPesquisa: true,
  })
}
