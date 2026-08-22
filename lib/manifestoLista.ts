import type { SupabaseClient } from '@supabase/supabase-js'
import { concluirCorridaMobilidade } from '@/lib/mobilidadeCorrida'
import { encerrarConversaCorrida } from '@/lib/mobilidadeChatCorrida'
import { concluirManifestoDiario } from '@/lib/manifestoDiario'
import { upsertCompraTurista } from '@/lib/turistaCompras'

export type PassageiroFilaStatus = 'pendente' | 'recebido' | 'cancelado'

type Ponto = { lat: number; lng: number }

type PaxGeo = {
  id: string
  dataAgendada: string | null
  lat: number | null
  lng: number | null
}

function metaObj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw != null && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {}
}

function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function distKm(a: Ponto, b: Ponto): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function pontoDe(p: { lat: number | null; lng: number | null }): Ponto | null {
  if (p.lat == null || p.lng == null || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
    return null
  }
  return { lat: p.lat, lng: p.lng }
}

/** Agendados por horário; “livre” no fim, ou encaixe GPS se veiculo_lugares > 4. */
export function ordenarFilaManifesto(
  pax: PaxGeo[],
  prof: Ponto | null,
  veiculoLugares: number,
): PaxGeo[] {
  const agendados = pax
    .filter((p) => p.dataAgendada)
    .sort((a, b) => String(a.dataAgendada).localeCompare(String(b.dataAgendada)))
  const livres = pax.filter((p) => !p.dataAgendada)

  if (veiculoLugares <= 4 || !prof) {
    return [...agendados, ...livres]
  }

  const rota: PaxGeo[] = [...agendados]
  for (const livre of livres) {
    const lv = pontoDe(livre)
    if (!lv) {
      rota.push(livre)
      continue
    }
    let bestIdx = rota.length
    let bestExtra = Number.POSITIVE_INFINITY
    for (let i = 0; i <= rota.length; i++) {
      const prev = i === 0 ? prof : pontoDe(rota[i - 1]) ?? prof
      const next = i < rota.length ? pontoDe(rota[i]) : null
      const extra =
        distKm(prev, lv) + (next ? distKm(lv, next) - distKm(prev, next) : 0)
      if (extra < bestExtra) {
        bestExtra = extra
        bestIdx = i
      }
    }
    rota.splice(bestIdx, 0, livre)
  }
  return rota
}

async function carregarGeoPassageiros(
  supabase: SupabaseClient,
  manifestoId: string,
  profissionalId: string,
): Promise<{ pax: PaxGeo[]; solicitacaoPorPax: Map<string, string> }> {
  const { data: rows } = await supabase
    .from('manifesto_passageiros')
    .select('id, turista_id, solicitacao_id, status')
    .eq('manifesto_id', manifestoId)

  const ativos = (rows ?? []).filter((r) => String(r.status ?? 'pendente') !== 'cancelado')
  const solicitacaoPorPax = new Map<string, string>()
  const turistaIds = ativos
    .map((r) => (r.turista_id != null ? String(r.turista_id) : ''))
    .filter(Boolean)

  const solIds = ativos
    .map((r) => (r.solicitacao_id != null ? String(r.solicitacao_id) : ''))
    .filter(Boolean)

  const sols: Record<string, {
    id: string
    turista_id: string | null
    data_agendada: string | null
    lat_origem: number | null
    lng_origem: number | null
  }> = {}

  if (solIds.length > 0) {
    const { data: byId } = await supabase
      .from('solicitacao_mobilidade')
      .select('id, turista_id, data_agendada, lat_origem, lng_origem')
      .in('id', solIds)
    for (const s of byId ?? []) {
      sols[String(s.id)] = {
        id: String(s.id),
        turista_id: s.turista_id != null ? String(s.turista_id) : null,
        data_agendada: s.data_agendada != null ? String(s.data_agendada) : null,
        lat_origem: s.lat_origem != null ? Number(s.lat_origem) : null,
        lng_origem: s.lng_origem != null ? Number(s.lng_origem) : null,
      }
    }
  }

  if (turistaIds.length > 0) {
    const { data: byTur } = await supabase
      .from('solicitacao_mobilidade')
      .select('id, turista_id, data_agendada, lat_origem, lng_origem, metadata')
      .eq('profissional_id', profissionalId)
      .in('turista_id', turistaIds)
      .in('status', ['aceita', 'a_caminho', 'no_local', 'em_viagem'])
    for (const s of byTur ?? []) {
      sols[String(s.id)] = {
        id: String(s.id),
        turista_id: s.turista_id != null ? String(s.turista_id) : null,
        data_agendada: s.data_agendada != null ? String(s.data_agendada) : null,
        lat_origem: s.lat_origem != null ? Number(s.lat_origem) : null,
        lng_origem: s.lng_origem != null ? Number(s.lng_origem) : null,
      }
    }
  }

  const pax: PaxGeo[] = ativos.map((r) => {
    const pid = String(r.id)
    const sid = r.solicitacao_id != null ? String(r.solicitacao_id) : ''
    let sol = sid ? sols[sid] : undefined
    if (!sol && r.turista_id) {
      sol = Object.values(sols).find((s) => s.turista_id === String(r.turista_id))
    }
    if (sol) solicitacaoPorPax.set(pid, sol.id)
    return {
      id: pid,
      dataAgendada: sol?.data_agendada ?? null,
      lat: sol?.lat_origem != null && Number.isFinite(sol.lat_origem) ? sol.lat_origem : null,
      lng: sol?.lng_origem != null && Number.isFinite(sol.lng_origem) ? sol.lng_origem : null,
    }
  })

  return { pax, solicitacaoPorPax }
}

export async function iniciarListaManifesto(
  supabase: SupabaseClient,
  params: { manifestoId: string; profissionalId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: md } = await supabase
    .from('manifesto_diario')
    .select('id, status, profissional_id, lista_iniciada_em')
    .eq('id', params.manifestoId)
    .eq('profissional_id', params.profissionalId)
    .maybeSingle()

  if (!md?.id) return { ok: false, error: 'Manifesto não encontrado.' }
  const st = String(md.status ?? '')
  if (st === 'concluido' || st === 'cancelado') {
    return { ok: false, error: 'Este manifesto já foi encerrado.' }
  }

  const { data: prof } = await supabase
    .from('profissionais')
    .select('veiculo_lugares, mobilidade_lat, mobilidade_lng')
    .eq('id', params.profissionalId)
    .maybeSingle()

  const lugares = Number(prof?.veiculo_lugares)
  const veiculoLugares = Number.isFinite(lugares) && lugares > 0 ? lugares : 4
  const profPonto: Ponto | null =
    prof?.mobilidade_lat != null &&
    prof?.mobilidade_lng != null &&
    Number.isFinite(Number(prof.mobilidade_lat)) &&
    Number.isFinite(Number(prof.mobilidade_lng))
      ? { lat: Number(prof.mobilidade_lat), lng: Number(prof.mobilidade_lng) }
      : null

  const { pax, solicitacaoPorPax } = await carregarGeoPassageiros(
    supabase,
    params.manifestoId,
    params.profissionalId,
  )

  if (pax.length === 0) return { ok: false, error: 'Não há passageiros para iniciar a lista.' }

  const ordenados = ordenarFilaManifesto(pax, profPonto, veiculoLugares)
  const agora = new Date().toISOString()

  for (let i = 0; i < ordenados.length; i++) {
    const sid = solicitacaoPorPax.get(ordenados[i].id) ?? null
    await supabase
      .from('manifesto_passageiros')
      .update({
        ordem: i + 1,
        ...(sid ? { solicitacao_id: sid } : {}),
      })
      .eq('id', ordenados[i].id)
  }

  await supabase
    .from('manifesto_diario')
    .update({
      lista_iniciada_em: md.lista_iniciada_em ?? agora,
      status: st === 'rascunho' || st === 'confirmado' ? 'em_andamento' : st,
      confirmado_em: agora,
      updated_at: agora,
    })
    .eq('id', params.manifestoId)

  await supabase
    .from('profissionais')
    .update({
      mobilidade_status: 'em_atendimento',
      mobilidade_status_em: agora,
    })
    .eq('id', params.profissionalId)

  return { ok: true }
}

export async function marcarPassageiroRecebido(
  supabase: SupabaseClient,
  params: { passageiroId: string; profissionalId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: p } = await supabase
    .from('manifesto_passageiros')
    .select('id, manifesto_id, status, solicitacao_id, turista_id')
    .eq('id', params.passageiroId)
    .maybeSingle()
  if (!p?.id) return { ok: false, error: 'Passageiro não encontrado.' }

  const { data: md } = await supabase
    .from('manifesto_diario')
    .select('id, profissional_id, lista_iniciada_em')
    .eq('id', p.manifesto_id)
    .eq('profissional_id', params.profissionalId)
    .maybeSingle()
  if (!md?.id) return { ok: false, error: 'Manifesto não encontrado.' }
  if (!md.lista_iniciada_em) return { ok: false, error: 'Inicie a lista antes de confirmar o receptivo.' }
  if (String(p.status) === 'cancelado') return { ok: false, error: 'Passageiro já cancelado.' }

  await supabase
    .from('manifesto_passageiros')
    .update({ status: 'recebido' })
    .eq('id', p.id)

  const sid = p.solicitacao_id != null ? String(p.solicitacao_id) : ''
  if (sid) {
    const { data: sol } = await supabase
      .from('solicitacao_mobilidade')
      .select('id, status, metadata')
      .eq('id', sid)
      .maybeSingle()
    const st = String(sol?.status ?? '')
    if (sol && ['aceita', 'a_caminho', 'no_local'].includes(st)) {
      await supabase
        .from('solicitacao_mobilidade')
        .update({
          status: 'em_viagem',
          metadata: {
            ...metaObj(sol.metadata),
            embarque_confirmado_em: new Date().toISOString(),
            fase: 'em_viagem',
          },
        })
        .eq('id', sid)
    }
  }

  return { ok: true }
}

export async function cancelarPassageiroManifesto(
  supabase: SupabaseClient,
  params: {
    passageiroId: string
    profissionalId: string
    justificativa: string
    profissionalUsuarioId: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const justificativa = params.justificativa.trim()
  if (justificativa.length < 3) {
    return { ok: false, error: 'Informe a justificativa do cancelamento.' }
  }

  const { data: p } = await supabase
    .from('manifesto_passageiros')
    .select('id, manifesto_id, status, solicitacao_id, turista_id, nome')
    .eq('id', params.passageiroId)
    .maybeSingle()
  if (!p?.id) return { ok: false, error: 'Passageiro não encontrado.' }

  const { data: md } = await supabase
    .from('manifesto_diario')
    .select('id, profissional_id, lista_iniciada_em')
    .eq('id', p.manifesto_id)
    .eq('profissional_id', params.profissionalId)
    .maybeSingle()
  if (!md?.id) return { ok: false, error: 'Manifesto não encontrado.' }
  if (!md.lista_iniciada_em) return { ok: false, error: 'Inicie a lista antes de cancelar um passageiro.' }
  if (String(p.status) === 'cancelado') return { ok: true }

  const agora = new Date().toISOString()
  await supabase
    .from('manifesto_passageiros')
    .update({
      status: 'cancelado',
      cancelamento_justificativa: justificativa,
      cancelado_em: agora,
    })
    .eq('id', p.id)

  const sid = p.solicitacao_id != null ? String(p.solicitacao_id) : ''
  if (sid) {
    const { data: sol } = await supabase
      .from('solicitacao_mobilidade')
      .select('id, status, metadata, origem_nome, destino_nome')
      .eq('id', sid)
      .maybeSingle()
    const st = String(sol?.status ?? '')
    if (sol && ['aceita', 'a_caminho', 'no_local', 'em_viagem'].includes(st)) {
      await supabase
        .from('solicitacao_mobilidade')
        .update({
          status: 'cancelada',
          metadata: {
            ...metaObj(sol.metadata),
            cancelado_em: agora,
            cancelamento_motivo: 'manifesto_x',
            cancelamento_por: 'profissional',
            cancelamento_justificativa: justificativa,
            fase: 'cancelada_manifesto',
          },
        })
        .eq('id', sid)
      await encerrarConversaCorrida(supabase, sid)
    }

    const turistaId = p.turista_id != null ? String(p.turista_id) : ''
    if (turistaId) {
      await upsertCompraTurista(supabase, {
        turistaUsuarioId: turistaId,
        tipo: 'mobilidade',
        referenciaId: sid || p.id,
        profissionalUsuarioId: params.profissionalUsuarioId,
        titulo: String(p.nome || 'Atendimento cancelado'),
        descricao: justificativa,
        status: 'cancelada',
        metadata: {
          kind: 'mobilidade_corrida',
          solicitacao_id: sid || null,
          justificativa,
          cancelamento_por: 'profissional',
        },
        resetVisto: true,
      })
    }
  }

  const { count } = await supabase
    .from('manifesto_passageiros')
    .select('id', { count: 'exact', head: true })
    .eq('manifesto_id', md.id)
    .neq('status', 'cancelado')

  if (!count) {
    await supabase
      .from('profissionais')
      .update({
        mobilidade_status: 'online',
        mobilidade_status_em: agora,
      })
      .eq('id', params.profissionalId)
  }

  return { ok: true }
}

export async function concluirAtendimentoManifesto(
  supabase: SupabaseClient,
  params: {
    manifestoId: string
    profissionalId: string
    profissionalUsuarioId: string
    pularCheckin?: boolean
  },
): Promise<{ ok: true } | { ok: false; error: string }> {

  const { data: md } = await supabase
    .from('manifesto_diario')
    .select('id, profissional_id, lista_iniciada_em, status')
    .eq('id', params.manifestoId)
    .eq('profissional_id', params.profissionalId)
    .maybeSingle()
  if (!md?.id) return { ok: false, error: 'Manifesto não encontrado.' }
  if (!md.lista_iniciada_em) return { ok: false, error: 'Inicie a lista antes de concluir.' }
  if (String(md.status) === 'concluido') return { ok: true }

  const { data: pax } = await supabase
    .from('manifesto_passageiros')
    .select('id, status, solicitacao_id')
    .eq('manifesto_id', params.manifestoId)

  const pendentes = (pax ?? []).filter((p) => String(p.status ?? 'pendente') === 'pendente')
  if (pendentes.length > 0) {
    return { ok: false, error: 'Receba ou cancele todos os passageiros antes de concluir.' }
  }

  const recebidos = (pax ?? []).filter((p) => String(p.status) === 'recebido')
  for (const p of recebidos) {
    const sid = p.solicitacao_id != null ? String(p.solicitacao_id) : ''
    if (!sid) continue
    const res = await concluirCorridaMobilidade(supabase, {
      solicitacaoId: sid,
      profissionalUsuarioId: params.profissionalUsuarioId,
      exigirManifestoOk: false,
      pagamentoConfirmadoDinheiro: true,
      pularManifesto: true,
      liberarProfissional: false,
    })
    if (!res.ok && !String(res.error).toLowerCase().includes('não está em andamento')) {
      return { ok: false, error: res.error }
    }
  }

  const man = await concluirManifestoDiario(supabase, params.manifestoId, params.profissionalId, {
    pularCheckin: params.pularCheckin === true,
  })
  if (!man.ok) return { ok: false, error: man.error ?? 'Não foi possível concluir o manifesto.' }

  await supabase
    .from('profissionais')
    .update({
      mobilidade_status: 'online',
      mobilidade_status_em: new Date().toISOString(),
    })
    .eq('id', params.profissionalId)

  return { ok: true }
}

export async function peekListaManifestoHoje(
  supabase: SupabaseClient,
  profissionalId: string,
): Promise<{
  iniciada: boolean
  manifestoId: string | null
  daVezSolicitacaoId: string | null
} | null> {
  const { data: md } = await supabase
    .from('manifesto_diario')
    .select('id, lista_iniciada_em, status')
    .eq('profissional_id', profissionalId)
    .eq('data_manifesto', hojeIsoLocal())
    .not('status', 'in', '("cancelado","concluido")')
    .maybeSingle()

  if (!md?.id) return null
  const iniciada = Boolean(md.lista_iniciada_em)
  if (!iniciada) {
    return { iniciada: false, manifestoId: String(md.id), daVezSolicitacaoId: null }
  }

  const { data: pax } = await supabase
    .from('manifesto_passageiros')
    .select('solicitacao_id')
    .eq('manifesto_id', md.id)
    .eq('status', 'pendente')
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    iniciada: true,
    manifestoId: String(md.id),
    daVezSolicitacaoId: pax?.solicitacao_id != null ? String(pax.solicitacao_id) : null,
  }
}
