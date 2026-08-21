import type { SupabaseClient } from '@supabase/supabase-js'
import { forwardGeocodeMapbox, montarQueryEnderecoEmpresa } from '@/lib/mapboxForwardGeocode'
import { pontoComCoords } from '@/lib/mobilidadePesquisaParams'
import { modalidadeUsaDeslocamentoProprio } from '@/lib/mobilidadeOfertaAtendimento'

function numOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export type PontosSolicitacaoMobilidade = {
  origemLat: number | null
  origemLng: number | null
  destinoLat: number | null
  destinoLng: number | null
}

/**
 * Completa lat/lng do destino (empresa do mapa ou geocode do nome).
 * Origem GPS não dá para inventar no servidor — o cliente precisa enviar.
 */
export async function enriquecerCoordsSolicitacaoMobilidade(
  admin: SupabaseClient,
  params: {
    origemLat: number | null
    origemLng: number | null
    destinoLat: number | null
    destinoLng: number | null
    destinoNome: string
    destinoEmpresaId: string | null
    destinoCidade?: string | null
  },
): Promise<PontosSolicitacaoMobilidade> {
  const origemLat = numOrNull(params.origemLat)
  const origemLng = numOrNull(params.origemLng)
  let destinoLat = numOrNull(params.destinoLat)
  let destinoLng = numOrNull(params.destinoLng)

  const empId = String(params.destinoEmpresaId ?? '').trim()
  if (!pontoComCoords({ lat: destinoLat, lng: destinoLng }) && empId) {
    const { data } = await admin
      .from('empresas')
      .select('latitude, longitude, nome_fantasia, endereco, bairro, cidade')
      .eq('id', empId)
      .maybeSingle()
    const lat = numOrNull(data?.latitude)
    const lng = numOrNull(data?.longitude)
    if (pontoComCoords({ lat, lng })) {
      destinoLat = lat
      destinoLng = lng
    } else if (data) {
      const q = montarQueryEnderecoEmpresa({
        endereco: data.endereco != null ? String(data.endereco) : null,
        bairro: data.bairro != null ? String(data.bairro) : null,
        cidade: data.cidade != null ? String(data.cidade) : params.destinoCidade,
      })
      const geo = await forwardGeocodeMapbox(q || String(data.nome_fantasia ?? ''))
      if (geo) {
        destinoLat = geo.lat
        destinoLng = geo.lng
      }
    }
  }

  if (!pontoComCoords({ lat: destinoLat, lng: destinoLng })) {
    const nome = String(params.destinoNome ?? '').trim()
    const cidade = String(params.destinoCidade ?? '').trim()
    const q = [nome, cidade || 'Foz do Iguaçu'].filter(Boolean).join(', ')
    if (nome.length >= 2) {
      const geo = await forwardGeocodeMapbox(q)
      if (geo) {
        destinoLat = geo.lat
        destinoLng = geo.lng
      }
    }
  }

  return { origemLat, origemLng, destinoLat, destinoLng }
}

/** Guia / van / taxista: origem e destino com GPS para chegada e rota. */
export function validarCoordsDeslocamentoProprio(
  modalidade: string,
  pts: PontosSolicitacaoMobilidade,
): string | null {
  if (!modalidadeUsaDeslocamentoProprio(modalidade)) return null
  if (!pontoComCoords({ lat: pts.origemLat, lng: pts.origemLng })) {
    return 'Ative o GPS para informar o ponto de partida.'
  }
  if (!pontoComCoords({ lat: pts.destinoLat, lng: pts.destinoLng })) {
    return 'Escolha um destino no mapa (empresa ou sugestão) para traçar a rota.'
  }
  return null
}
