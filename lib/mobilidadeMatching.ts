import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'
import { abrirOuObterConversaCorrida } from '@/lib/mobilidadeChatCorrida'
import { registrarManifestoAposAceiteCorrida } from '@/lib/mobilidadeCorrida'
import {
  criarSolicitacaoAgendada,
  ehAgendamentoFuturo,
  parseDataAgendadaIso,
} from '@/lib/mobilidadeAgendamento'
import { isJustificativaRecusaMobilidade } from '@/lib/mobilidadeRecusaJustificativas'
import { inferirCidadeTriplicePorCoords } from '@/lib/mobilidadePopupPesquisa'
import type { ModalidadeMobilidadeId } from '@/lib/mobilidadePopupPesquisa'
import type { CidadeTriplice } from '@/lib/mobilidadeRegional'
import { normalizarIdiomasGuia } from '@/lib/idiomasGuia'
import {
  normalizarMoedaModo,
  normalizarMoedasPreferencia,
  normalizarVeiculoLugares,
  scoreIdiomaSoftRank,
  scoreMoedaSoftRank,
  type MoedaModoProfissional,
} from '@/lib/mobilidadePerfilProfissional'

/** Tempo total para aceitar (ms). */
export const MOBILIDADE_OFERTA_TIMEOUT_MS = 45_000
/** Após este tempo a UI muda para amarelo (aviso). */
export const MOBILIDADE_OFERTA_WARN_MS = 30_000
/** Backups ocultos além do oferecido. */
export const MOBILIDADE_BACKUPS_OCULTOS = 2

export type CandidatoMatch = {
  id: string
  usuario_id: string
  nome_completo: string
  nome_usuario: string | null
  foto_url: string | null
  categorias: string[]
  placa_vermelha: boolean
  lat: number
  lng: number
  distanciaKm: number
  cidade: CidadeTriplice | null
  veiculo_lugares: number | null
  idiomas: string[]
  moeda_modo: MoedaModoProfissional
  moedas_preferencia: string[]
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h =
    s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function modalidadeMatchaCategorias(
  modalidade: ModalidadeMobilidadeId,
  cats: string[],
  placaVermelha: boolean,
): boolean {
  if (modalidade === 'motorista_app') return cats.includes('motorista_app')
  if (modalidade === 'van') return cats.includes('van') || (placaVermelha && cats.includes('van'))
  if (modalidade === 'taxista') return cats.includes('taxista')
  if (modalidade === 'guia') return cats.includes('guia')
  return false
}

/**
 * Candidatos online (não em atendimento), filtrados por modalidade e regras de fronteira/cidade.
 */
export async function buscarCandidatosMobilidade(
  admin: SupabaseClient,
  params: {
    modalidade: ModalidadeMobilidadeId
    cruzamentoFronteira: boolean
    origemLat: number
    origemLng: number
    cidadeOrigem: CidadeTriplice | null
    /** Capacidade mínima do veículo (van/táxi/guia). */
    lugares?: number
  },
): Promise<CandidatoMatch[]> {
  const lugaresPedidos = Math.max(1, Number(params.lugares) || 1)

  let data: Record<string, unknown>[] | null = null
  let error: { message: string } | null = null

  {
    const res = await admin
      .from('profissionais')
      .select(
        'id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, placa_vermelha, mobilidade_status, mobilidade_lat, mobilidade_lng, veiculo_lugares, idiomas, moeda_modo, moedas_preferencia',
      )
      .eq('mobilidade_status', 'online')
      .not('mobilidade_lat', 'is', null)
      .not('mobilidade_lng', 'is', null)
    data = (res.data as Record<string, unknown>[] | null) ?? null
    error = res.error
    // Colunas novas podem não existir ainda — fallback sem elas
    if (
      error &&
      /veiculo_lugares|idiomas|moeda_modo|moedas_preferencia/i.test(error.message)
    ) {
      const res2 = await admin
        .from('profissionais')
        .select(
          'id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, placa_vermelha, mobilidade_status, mobilidade_lat, mobilidade_lng',
        )
        .eq('mobilidade_status', 'online')
        .not('mobilidade_lat', 'is', null)
        .not('mobilidade_lng', 'is', null)
      data = (res2.data as Record<string, unknown>[] | null) ?? null
      error = res2.error
    }
  }

  if (error || !data) return []

  const out: CandidatoMatch[] = []
  for (const row of data) {
    const cats = normalizarCategoriasProfissional(
      Array.isArray(row.categorias) ? (row.categorias as unknown[]).map(String) : [],
    )
    const placa = Boolean(row.placa_vermelha)
    if (!modalidadeMatchaCategorias(params.modalidade, cats, placa)) continue

    if (params.cruzamentoFronteira) {
      if (!placa) continue
      if (params.modalidade === 'motorista_app') continue
    }

    const lat = Number(row.mobilidade_lat)
    const lng = Number(row.mobilidade_lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const cidadeProf = inferirCidadeTriplicePorCoords(lat, lng)

    // Dentro da cidade: preferir mesma cidade de origem
    if (!params.cruzamentoFronteira && params.cidadeOrigem && cidadeProf) {
      if (cidadeProf !== params.cidadeOrigem) continue
    }

    const capacidade = normalizarVeiculoLugares(row.veiculo_lugares)
    // Filtra só quando o profissional cadastrou capacidade; sem cadastro ainda entra
    if (
      capacidade != null &&
      (params.modalidade === 'van' ||
        params.modalidade === 'taxista' ||
        params.modalidade === 'guia') &&
      capacidade < lugaresPedidos
    ) {
      continue
    }

    out.push({
      id: String(row.id),
      usuario_id: String(row.usuario_id),
      nome_completo: String(row.nome_completo ?? ''),
      nome_usuario: row.nome_usuario != null ? String(row.nome_usuario) : null,
      foto_url:
        row.foto_perfil_url != null
          ? String(row.foto_perfil_url)
          : row.foto_url != null
            ? String(row.foto_url)
            : null,
      categorias: cats,
      placa_vermelha: placa,
      lat,
      lng,
      distanciaKm: haversineKm(params.origemLat, params.origemLng, lat, lng),
      cidade: cidadeProf,
      veiculo_lugares: capacidade,
      idiomas: normalizarIdiomasGuia(row.idiomas),
      moeda_modo: normalizarMoedaModo(row.moeda_modo),
      moedas_preferencia: normalizarMoedasPreferencia(row.moedas_preferencia),
    })
  }

  out.sort((a, b) => a.distanciaKm - b.distanciaKm)
  return out
}

function ordenarCandidatosSoftRank(
  candidatos: CandidatoMatch[],
  opts: {
    idiomaPreferido: string | null
    pagamento: string | null
    moedasDinheiro: string[]
  },
): CandidatoMatch[] {
  return [...candidatos].sort((a, b) => {
    const ia = scoreIdiomaSoftRank(a.idiomas, opts.idiomaPreferido)
    const ib = scoreIdiomaSoftRank(b.idiomas, opts.idiomaPreferido)
    if (ia !== ib) return ia - ib

    const ma = scoreMoedaSoftRank(
      a.moeda_modo,
      a.moedas_preferencia,
      opts.pagamento,
      opts.moedasDinheiro,
    )
    const mb = scoreMoedaSoftRank(
      b.moeda_modo,
      b.moedas_preferencia,
      opts.pagamento,
      opts.moedasDinheiro,
    )
    if (ma !== mb) return ma - mb

    return a.distanciaKm - b.distanciaKm
  })
}

export type SolicitarMobilidadeInput = {
  turistaUsuarioId: string
  modalidade: ModalidadeMobilidadeId
  origemNome: string
  destinoNome: string
  origemLat: number | null
  origemLng: number | null
  destinoLat: number | null
  destinoLng: number | null
  destinoEmpresaId: string | null
  cruzamentoFronteira: boolean
  cidadeOrigem: CidadeTriplice | null
  valorEstimado: number | null
  pagamento: string | null
  lugares: number
  acompanhamentoGuia: boolean
  dataAgendada: string | null
  recomendacaoId: string | null
  /** profissionais.id fixado (indicação / contratar=). */
  profissionalFixadoId: string | null
  idiomaPreferido?: string | null
  moedasDinheiro?: string[]
}

/** Resolve profissionais.id a partir de recomendação e/ou usuario_id. */
export async function resolverProfissionalFixadoMobilidade(
  admin: SupabaseClient,
  params: {
    recomendacaoId: string | null
    profissionalUsuarioId: string | null
  },
): Promise<{ profissionalId: string | null; recomendacaoId: string | null }> {
  let recomendacaoId = params.recomendacaoId
  let profissionalId: string | null = null

  if (recomendacaoId) {
    const { data: rec } = await admin
      .from('recomendacoes_profissional')
      .select('id, profissional_indicado_id')
      .eq('id', recomendacaoId)
      .maybeSingle()
    if (rec?.profissional_indicado_id) {
      profissionalId = String(rec.profissional_indicado_id)
      recomendacaoId = String(rec.id)
    } else {
      recomendacaoId = null
    }
  }

  if (!profissionalId && params.profissionalUsuarioId) {
    const { data: p } = await admin
      .from('profissionais')
      .select('id')
      .eq('usuario_id', params.profissionalUsuarioId)
      .maybeSingle()
    if (p?.id) profissionalId = String(p.id)
  }

  return { profissionalId, recomendacaoId }
}

function priorizarFixadoNaFila(
  candidatos: CandidatoMatch[],
  fixadoId: string | null,
): CandidatoMatch[] {
  if (!fixadoId) return candidatos
  const idx = candidatos.findIndex((c) => c.id === fixadoId)
  if (idx <= 0) return candidatos
  const copy = [...candidatos]
  const [fixado] = copy.splice(idx, 1)
  return [fixado, ...copy]
}

export type SolicitarMobilidadeResult =
  | {
      ok: true
      solicitacaoId: string
      status: string
      redirectParceiro: string | null
      oferta: {
        profissionalId: string
        nome: string
        username: string | null
        fotoUrl: string | null
        distanciaKm: number
        expiraEm: string
      } | null
      backupsOcultos: number
    }
  | { ok: false; error: string }

export async function criarSolicitacaoEOfertar(
  admin: SupabaseClient,
  input: SolicitarMobilidadeInput,
  apiMobilidadeUrl: string | null,
): Promise<SolicitarMobilidadeResult> {
  const quando = parseDataAgendadaIso(input.dataAgendada)
  if (ehAgendamentoFuturo(quando)) {
    const ag = await criarSolicitacaoAgendada(admin, {
      ...input,
      dataAgendada: quando!.toISOString(),
    })
    if (!ag.ok) return { ok: false, error: ag.error }
    return {
      ok: true,
      solicitacaoId: ag.solicitacaoId,
      status: ag.status,
      redirectParceiro: null,
      oferta: ag.oferta,
      backupsOcultos: ag.backupsOcultos,
    }
  }

  // Motorista app + urbano + API parceira → redirect
  if (input.modalidade === 'motorista_app' && !input.cruzamentoFronteira) {
    const url = String(apiMobilidadeUrl ?? '').trim()
    if (url) {
      const { data: row, error } = await admin
        .from('solicitacao_mobilidade')
        .insert({
          turista_id: input.turistaUsuarioId,
          profissional_id: null,
          status: 'pendente',
          tipo_servico: 'mobilidade',
          modalidade: input.modalidade,
          origem_nome: input.origemNome,
          destino_nome: input.destinoNome,
          lat_origem: input.origemLat,
          lng_origem: input.origemLng,
          lat_destino: input.destinoLat,
          lng_destino: input.destinoLng,
          destino_empresa_id: input.destinoEmpresaId,
          cruzamento_fronteira: false,
          valor_estimado: input.valorEstimado,
          pagamento: input.pagamento,
          lugares: input.lugares,
          acompanhamento_guia: false,
          data_agendada: input.dataAgendada,
          recomendacao_id: input.recomendacaoId,
          metadata: { destino: 'api_parceiro', api_url: url },
        })
        .select('id')
        .maybeSingle()

      if (error || !row?.id) {
        return { ok: false, error: error?.message ?? 'Falha ao registrar solicitação.' }
      }

      return {
        ok: true,
        solicitacaoId: String(row.id),
        status: 'pendente',
        redirectParceiro: url,
        oferta: null,
        backupsOcultos: 0,
      }
    }
  }

  if (input.origemLat == null || input.origemLng == null) {
    return { ok: false, error: 'Origem com GPS é necessária para localizar profissionais.' }
  }

  let candidatos = await buscarCandidatosMobilidade(admin, {
    modalidade: input.modalidade,
    cruzamentoFronteira: input.cruzamentoFronteira,
    origemLat: input.origemLat,
    origemLng: input.origemLng,
    cidadeOrigem: input.cidadeOrigem,
    lugares: input.lugares,
  })

  candidatos = ordenarCandidatosSoftRank(candidatos, {
    idiomaPreferido: input.idiomaPreferido ?? null,
    pagamento: input.pagamento,
    moedasDinheiro: input.moedasDinheiro ?? [],
  })

  // Indicação: se o fixado está online mas fora do filtro de cidade, ainda inclui no topo.
  if (input.profissionalFixadoId) {
    const jaTem = candidatos.some((c) => c.id === input.profissionalFixadoId)
    if (!jaTem) {
      const { data: fix } = await admin
        .from('profissionais')
        .select(
          'id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, placa_vermelha, mobilidade_status, mobilidade_lat, mobilidade_lng, veiculo_lugares, idiomas, moeda_modo, moedas_preferencia',
        )
        .eq('id', input.profissionalFixadoId)
        .eq('mobilidade_status', 'online')
        .maybeSingle()
      if (fix) {
        const cats = normalizarCategoriasProfissional(
          Array.isArray(fix.categorias) ? fix.categorias.map(String) : [],
        )
        const placa = Boolean(fix.placa_vermelha)
        if (modalidadeMatchaCategorias(input.modalidade, cats, placa)) {
          const lat = Number(fix.mobilidade_lat)
          const lng = Number(fix.mobilidade_lng)
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            candidatos = [
              {
                id: String(fix.id),
                usuario_id: String(fix.usuario_id),
                nome_completo: String(fix.nome_completo ?? ''),
                nome_usuario: fix.nome_usuario != null ? String(fix.nome_usuario) : null,
                foto_url:
                  fix.foto_perfil_url != null
                    ? String(fix.foto_perfil_url)
                    : fix.foto_url != null
                      ? String(fix.foto_url)
                      : null,
                categorias: cats,
                placa_vermelha: placa,
                lat,
                lng,
                distanciaKm: haversineKm(input.origemLat, input.origemLng, lat, lng),
                cidade: inferirCidadeTriplicePorCoords(lat, lng),
                veiculo_lugares: normalizarVeiculoLugares(fix.veiculo_lugares),
                idiomas: normalizarIdiomasGuia(fix.idiomas),
                moeda_modo: normalizarMoedaModo(fix.moeda_modo),
                moedas_preferencia: normalizarMoedasPreferencia(fix.moedas_preferencia),
              },
              ...candidatos,
            ]
          }
        }
      }
    }
    candidatos = priorizarFixadoNaFila(candidatos, input.profissionalFixadoId)
  }

  const filaIds = candidatos.map((c) => c.id)
  const agora = Date.now()
  const expira = new Date(agora + MOBILIDADE_OFERTA_TIMEOUT_MS).toISOString()
  const primeiro = candidatos[0] ?? null

  const moedasDinheiro = normalizarMoedasPreferencia(input.moedasDinheiro)
  const idiomaPref =
    input.idiomaPreferido != null && String(input.idiomaPreferido).trim()
      ? String(input.idiomaPreferido).trim().toLowerCase()
      : null

  const insertBase = {
    turista_id: input.turistaUsuarioId,
    profissional_id: null as null,
    status: primeiro ? 'oferecida' : 'sem_profissional',
    tipo_servico: 'mobilidade',
    modalidade: input.modalidade,
    origem_nome: input.origemNome,
    destino_nome: input.destinoNome,
    lat_origem: input.origemLat,
    lng_origem: input.origemLng,
    lat_destino: input.destinoLat,
    lng_destino: input.destinoLng,
    destino_empresa_id: input.destinoEmpresaId,
    cruzamento_fronteira: input.cruzamentoFronteira,
    valor_estimado: input.valorEstimado,
    pagamento: input.pagamento,
    lugares: input.lugares,
    acompanhamento_guia: input.acompanhamentoGuia,
    data_agendada: input.dataAgendada,
    recomendacao_id: input.recomendacaoId,
    fila_profissional_ids: filaIds,
    fila_indice: 0,
    oferta_profissional_id: primeiro?.id ?? null,
    oferta_expira_em: primeiro ? expira : null,
    metadata: {
      backups: Math.min(MOBILIDADE_BACKUPS_OCULTOS, Math.max(0, filaIds.length - 1)),
      profissional_fixado_id: input.profissionalFixadoId,
      idioma_preferido: idiomaPref,
      moedas_dinheiro: moedasDinheiro,
      distancias_km: candidatos.slice(0, 5).map((c) => ({
        id: c.id,
        km: Math.round(c.distanciaKm * 10) / 10,
      })),
    },
  }

  let row: { id: string } | null = null
  let error: { message: string } | null = null

  {
    const res = await admin
      .from('solicitacao_mobilidade')
      .insert({
        ...insertBase,
        idioma_preferido: idiomaPref,
        moedas_dinheiro: moedasDinheiro,
      })
      .select('id')
      .maybeSingle()
    row = res.data as { id: string } | null
    error = res.error
    if (error && /idioma_preferido|moedas_dinheiro/i.test(error.message)) {
      const res2 = await admin.from('solicitacao_mobilidade').insert(insertBase).select('id').maybeSingle()
      row = res2.data as { id: string } | null
      error = res2.error
    }
  }

  if (error || !row?.id) {
    return { ok: false, error: error?.message ?? 'Falha ao criar solicitação.' }
  }

  return {
    ok: true,
    solicitacaoId: String(row.id),
    status: primeiro ? 'oferecida' : 'sem_profissional',
    redirectParceiro: null,
    oferta: primeiro
      ? {
          profissionalId: primeiro.id,
          nome: primeiro.nome_completo,
          username: primeiro.nome_usuario,
          fotoUrl: primeiro.foto_url,
          distanciaKm: Math.round(primeiro.distanciaKm * 10) / 10,
          expiraEm: expira,
        }
      : null,
    backupsOcultos: Math.min(MOBILIDADE_BACKUPS_OCULTOS, Math.max(0, filaIds.length - 1)),
  }
}

/** Se a oferta expirou, avança para o próximo da fila. */
export async function avancarFilaSeExpirada(
  admin: SupabaseClient,
  solicitacaoId: string,
): Promise<{
  status: string
  oferta: {
    profissionalId: string
    nome: string
    username: string | null
    fotoUrl: string | null
    distanciaKm: number
    expiraEm: string
  } | null
}> {
  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select(
      'id, status, oferta_expira_em, oferta_profissional_id, fila_profissional_ids, fila_indice, recusados_ids, lat_origem, lng_origem',
    )
    .eq('id', solicitacaoId)
    .maybeSingle()

  if (!row || row.status !== 'oferecida') {
    return { status: String(row?.status ?? 'cancelada'), oferta: null }
  }

  const expira = row.oferta_expira_em ? new Date(String(row.oferta_expira_em)).getTime() : 0
  if (Number.isFinite(expira) && Date.now() < expira) {
    // ainda válida — carregar dados do profissional
    const oferta = await montarOfertaAtual(admin, row)
    return { status: 'oferecida', oferta }
  }

  return avancarParaProximo(admin, row)
}

async function montarOfertaAtual(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{
  profissionalId: string
  nome: string
  username: string | null
  fotoUrl: string | null
  distanciaKm: number
  expiraEm: string
} | null> {
  const pid = row.oferta_profissional_id != null ? String(row.oferta_profissional_id) : ''
  if (!pid) return null
  const { data: p } = await admin
    .from('profissionais')
    .select('id, nome_completo, nome_usuario, foto_perfil_url, foto_url, mobilidade_lat, mobilidade_lng')
    .eq('id', pid)
    .maybeSingle()
  if (!p) return null
  const oLat = Number(row.lat_origem)
  const oLng = Number(row.lng_origem)
  const pLat = Number(p.mobilidade_lat)
  const pLng = Number(p.mobilidade_lng)
  let km = 0
  if (Number.isFinite(oLat) && Number.isFinite(oLng) && Number.isFinite(pLat) && Number.isFinite(pLng)) {
    km = Math.round(haversineKm(oLat, oLng, pLat, pLng) * 10) / 10
  }
  return {
    profissionalId: String(p.id),
    nome: String(p.nome_completo ?? ''),
    username: p.nome_usuario != null ? String(p.nome_usuario) : null,
    fotoUrl:
      p.foto_perfil_url != null
        ? String(p.foto_perfil_url)
        : p.foto_url != null
          ? String(p.foto_url)
          : null,
    distanciaKm: km,
    expiraEm: String(row.oferta_expira_em ?? ''),
  }
}

async function avancarParaProximo(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{
  status: string
  oferta: {
    profissionalId: string
    nome: string
    username: string | null
    fotoUrl: string | null
    distanciaKm: number
    expiraEm: string
  } | null
}> {
  const fila = Array.isArray(row.fila_profissional_ids)
    ? (row.fila_profissional_ids as string[]).map(String)
    : []
  const recusados = new Set(
    Array.isArray(row.recusados_ids) ? (row.recusados_ids as string[]).map(String) : [],
  )
  if (row.oferta_profissional_id) recusados.add(String(row.oferta_profissional_id))

  let idx = Number(row.fila_indice ?? 0) + 1
  while (idx < fila.length && recusados.has(fila[idx])) idx += 1

  if (idx >= fila.length) {
    await admin
      .from('solicitacao_mobilidade')
      .update({
        status: 'sem_profissional',
        oferta_profissional_id: null,
        oferta_expira_em: null,
        fila_indice: idx,
        recusados_ids: [...recusados],
      })
      .eq('id', row.id)
    return { status: 'sem_profissional', oferta: null }
  }

  const nextId = fila[idx]
  const expira = new Date(Date.now() + MOBILIDADE_OFERTA_TIMEOUT_MS).toISOString()
  await admin
    .from('solicitacao_mobilidade')
    .update({
      status: 'oferecida',
      oferta_profissional_id: nextId,
      oferta_expira_em: expira,
      fila_indice: idx,
      recusados_ids: [...recusados],
    })
    .eq('id', row.id)

  const oferta = await montarOfertaAtual(admin, {
    ...row,
    oferta_profissional_id: nextId,
    oferta_expira_em: expira,
  })
  return { status: 'oferecida', oferta }
}

export async function responderOfertaMobilidade(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    profissionalUsuarioId: string
    aceitar: boolean
    justificativa?: string | null
  },
): Promise<{ ok: boolean; error?: string; status?: string; conversaId?: string | null }> {
  const { data: prof } = await admin
    .from('profissionais')
    .select('id, placa_vermelha')
    .eq('usuario_id', params.profissionalUsuarioId)
    .maybeSingle()
  if (!prof?.id) return { ok: false, error: 'Profissional não encontrado.' }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select('*')
    .eq('id', params.solicitacaoId)
    .maybeSingle()

  if (!row || row.status !== 'oferecida') {
    return { ok: false, error: 'Oferta não está mais disponível.' }
  }
  if (String(row.oferta_profissional_id) !== String(prof.id)) {
    return { ok: false, error: 'Esta oferta não é sua.' }
  }

  if (params.aceitar) {
    const agora = new Date().toISOString()

    const metaBase = {
      ...(typeof row.metadata === 'object' && row.metadata ? row.metadata : {}),
      aceito_em: agora,
    }

    const metaComManifesto = await registrarManifestoAposAceiteCorrida(admin, {
      profissionalId: String(prof.id),
      placaVermelha: Boolean(prof.placa_vermelha),
      turistaUsuarioId: String(row.turista_id),
      recomendacaoId: row.recomendacao_id != null ? String(row.recomendacao_id) : null,
      destinoEmpresaId: row.destino_empresa_id != null ? String(row.destino_empresa_id) : null,
      solicitacaoId: params.solicitacaoId,
      metadataAtual: metaBase,
      dataAgendada: row.data_agendada != null ? String(row.data_agendada) : null,
    })

    await admin
      .from('solicitacao_mobilidade')
      .update({
        status: 'aceita',
        profissional_id: prof.id,
        oferta_expira_em: null,
        metadata: metaComManifesto,
      })
      .eq('id', params.solicitacaoId)

    await admin
      .from('profissionais')
      .update({
        mobilidade_status: 'em_atendimento',
        mobilidade_status_em: agora,
      })
      .eq('id', prof.id)

    const chat = await abrirOuObterConversaCorrida(admin, {
      solicitacaoId: params.solicitacaoId,
      turistaUsuarioId: String(row.turista_id),
      profissionalUsuarioId: params.profissionalUsuarioId,
    })
    if ('error' in chat) {
      return { ok: true, status: 'aceita', conversaId: null }
    }

    return { ok: true, status: 'aceita', conversaId: chat.conversaId }
  }

  // recusa — exige justificativa válida
  const just = String(params.justificativa ?? '').trim()
  if (!isJustificativaRecusaMobilidade(just)) {
    return { ok: false, error: 'Selecione uma justificativa de recusa.' }
  }

  const recusados = Array.isArray(row.recusados_ids)
    ? (row.recusados_ids as string[]).map(String)
    : []
  recusados.push(String(prof.id))
  await admin
    .from('solicitacao_mobilidade')
    .update({
      recusados_ids: recusados,
      metadata: {
        ...(typeof row.metadata === 'object' && row.metadata ? row.metadata : {}),
        ultima_recusa: {
          profissional_id: prof.id,
          justificativa: just,
          em: new Date().toISOString(),
        },
      },
    })
    .eq('id', params.solicitacaoId)

  // força avanço
  await admin
    .from('solicitacao_mobilidade')
    .update({ oferta_expira_em: new Date(0).toISOString() })
    .eq('id', params.solicitacaoId)

  const avancou = await avancarFilaSeExpirada(admin, params.solicitacaoId)
  return { ok: true, status: avancou.status }
}
