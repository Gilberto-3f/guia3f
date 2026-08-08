/** Pontos e linha azul da corrida ativa no mapa (imediato). */

export type PontoMapaCorrida = {
  lat: number
  lng: number
  label?: string
}

export type CorridaMapaCoords = {
  status?: string | null
  data_agendada?: string | null
  origem_nome?: string | null
  destino_nome?: string | null
  lat_origem?: number | null
  lng_origem?: number | null
  lat_destino?: number | null
  lng_destino?: number | null
  prof_lat?: number | null
  prof_lng?: number | null
}

function pontoValido(
  lat: number | null | undefined,
  lng: number | null | undefined,
  label?: string | null,
): PontoMapaCorrida | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, label: label || undefined }
}

export function pontoPartidaCorrida(c: CorridaMapaCoords | null | undefined): PontoMapaCorrida | null {
  if (!c) return null
  return pontoValido(c.lat_origem, c.lng_origem, c.origem_nome)
}

export function pontoDestinoCorrida(c: CorridaMapaCoords | null | undefined): PontoMapaCorrida | null {
  if (!c) return null
  return pontoValido(c.lat_destino, c.lng_destino, c.destino_nome)
}

export function pontoProfissionalCorrida(
  c: CorridaMapaCoords | null | undefined,
): PontoMapaCorrida | null {
  if (!c) return null
  return pontoValido(c.prof_lat, c.prof_lng)
}

/**
 * a_caminho / aceita / no_local → pro → partida
 * em_viagem → partida → destino (fallback pro → destino)
 */
export function montarTrajetoCorridaAtiva(c: CorridaMapaCoords | null | undefined): {
  de: PontoMapaCorrida
  ate: PontoMapaCorrida
} | null {
  if (!c) return null
  const st = String(c.status ?? '')
  const partida = pontoPartidaCorrida(c)
  const destino = pontoDestinoCorrida(c)
  const prof = pontoProfissionalCorrida(c)

  if (st === 'em_viagem') {
    if (partida && destino) return { de: partida, ate: destino }
    if (prof && destino) return { de: prof, ate: destino }
    return null
  }

  if (['aceita', 'a_caminho', 'no_local'].includes(st)) {
    if (prof && partida) return { de: prof, ate: partida }
    if (partida && destino) return { de: partida, ate: destino }
    return null
  }

  return null
}

/** Marcador de destino só faz sentido em viagem (ou se não houver trajeto de ida). */
export function destinoVisivelNoMapa(c: CorridaMapaCoords | null | undefined): PontoMapaCorrida | null {
  if (!c) return null
  const st = String(c.status ?? '')
  if (st === 'em_viagem') return pontoDestinoCorrida(c)
  return null
}
