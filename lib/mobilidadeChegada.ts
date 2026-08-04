import type { SupabaseClient } from '@supabase/supabase-js'
import { encerrarConversaCorrida } from '@/lib/mobilidadeChatCorrida'

/** Raio (metros) para considerar chegada no ponto de partida. */
export const RAIO_CHEGADA_METROS = 100
/** Folga extra no servidor (GPS impreciso). */
export const RAIO_CHEGADA_SERVIDOR_METROS = 160

function metaObj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw != null && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {}
}

/** Distância em metros (haversine). */
export function distanciaMetros(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function profissionalChegouNaPartida(params: {
  profLat: number
  profLng: number
  origemLat: number
  origemLng: number
  raioMetros?: number
}): boolean {
  const raio = params.raioMetros ?? RAIO_CHEGADA_METROS
  return (
    distanciaMetros(params.profLat, params.profLng, params.origemLat, params.origemLng) <=
    raio
  )
}

/**
 * GPS do profissional entrou no raio da partida → status `no_local`
 * (popup VOCÊ CHEGOU no pro + Profissional CHEGOU no turista).
 */
export async function registrarChegadaNoLocal(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    profissionalUsuarioId: string
    lat: number
    lng: number
  },
): Promise<{ ok: true; status: 'no_local'; distancia_m: number } | { ok: false; error: string }> {
  const { data: prof } = await admin
    .from('profissionais')
    .select('id')
    .eq('usuario_id', params.profissionalUsuarioId)
    .maybeSingle()
  if (!prof?.id) return { ok: false, error: 'Profissional não encontrado.' }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select('id, status, profissional_id, lat_origem, lng_origem, metadata')
    .eq('id', params.solicitacaoId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Solicitação não encontrada.' }
  if (String(row.profissional_id) !== String(prof.id)) {
    return { ok: false, error: 'Esta corrida não é sua.' }
  }

  const st = String(row.status)
  if (st === 'no_local') {
    return { ok: true, status: 'no_local', distancia_m: 0 }
  }
  if (st !== 'a_caminho' && st !== 'aceita') {
    return { ok: false, error: 'Corrida não está a caminho do ponto de partida.' }
  }

  const oLat = Number(row.lat_origem)
  const oLng = Number(row.lng_origem)
  if (!Number.isFinite(oLat) || !Number.isFinite(oLng)) {
    return { ok: false, error: 'Ponto de partida sem coordenadas.' }
  }
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    return { ok: false, error: 'GPS inválido.' }
  }

  const dist = distanciaMetros(params.lat, params.lng, oLat, oLng)
  if (dist > RAIO_CHEGADA_SERVIDOR_METROS) {
    return {
      ok: false,
      error: `Ainda fora do local (≈${Math.round(dist)} m). Aproxime-se do ponto de partida.`,
    }
  }

  const agora = new Date().toISOString()
  const meta = {
    ...metaObj(row.metadata),
    chegada_no_local_em: agora,
    chegada_distancia_m: Math.round(dist),
    fase: 'no_local',
  }

  await admin
    .from('solicitacao_mobilidade')
    .update({ status: 'no_local', metadata: meta })
    .eq('id', params.solicitacaoId)

  await admin
    .from('profissionais')
    .update({
      mobilidade_lat: params.lat,
      mobilidade_lng: params.lng,
      mobilidade_status_em: agora,
    })
    .eq('id', prof.id)

  return { ok: true, status: 'no_local', distancia_m: Math.round(dist) }
}

/**
 * SIM → `em_viagem` (trajeto até o destino).
 * NÃO → cancela e arquiva (turista não recebido).
 */
export async function responderEmbarqueNoLocal(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    profissionalUsuarioId: string
    turistaRecebido: boolean
  },
): Promise<
  | { ok: true; status: 'em_viagem' | 'cancelada' }
  | { ok: false; error: string }
> {
  const { data: prof } = await admin
    .from('profissionais')
    .select('id')
    .eq('usuario_id', params.profissionalUsuarioId)
    .maybeSingle()
  if (!prof?.id) return { ok: false, error: 'Profissional não encontrado.' }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select('id, status, profissional_id, metadata')
    .eq('id', params.solicitacaoId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Solicitação não encontrada.' }
  if (String(row.profissional_id) !== String(prof.id)) {
    return { ok: false, error: 'Esta corrida não é sua.' }
  }
  if (String(row.status) !== 'no_local') {
    return { ok: false, error: 'Confirmação de embarque só no local de partida.' }
  }

  const agora = new Date().toISOString()
  const meta = metaObj(row.metadata)

  if (params.turistaRecebido) {
    await admin
      .from('solicitacao_mobilidade')
      .update({
        status: 'em_viagem',
        metadata: {
          ...meta,
          embarque_confirmado_em: agora,
          fase: 'em_viagem',
        },
      })
      .eq('id', params.solicitacaoId)
    return { ok: true, status: 'em_viagem' }
  }

  await admin
    .from('solicitacao_mobilidade')
    .update({
      status: 'cancelada',
      metadata: {
        ...meta,
        cancelado_em: agora,
        cancelamento_motivo: 'turista_nao_recebido',
        cancelamento_por: 'profissional',
        arquivado: true,
        fase: 'cancelada_no_local',
      },
    })
    .eq('id', params.solicitacaoId)

  await admin
    .from('profissionais')
    .update({
      mobilidade_status: 'online',
      mobilidade_status_em: agora,
    })
    .eq('id', prof.id)

  await encerrarConversaCorrida(admin, params.solicitacaoId)

  return { ok: true, status: 'cancelada' }
}
