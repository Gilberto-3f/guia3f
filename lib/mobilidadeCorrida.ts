import type { SupabaseClient } from '@supabase/supabase-js'
import {
  concluirManifestoDiario,
  filtrarEmpresaIds,
  registrarTuristaNoManifesto,
  type ContratacaoTipo,
} from '@/lib/manifestoDiario'
import { encerrarConversaCorrida } from '@/lib/mobilidadeChatCorrida'
import { liquidarComissaoCorridaMobilidade } from '@/lib/mobilidadeFinanceiro'
import { registrarCompraTuristaCorridaMobilidade } from '@/lib/turistaCompras'
import { modalidadeUsaDeslocamentoProprio } from '@/lib/mobilidadeOfertaAtendimento'
import { mediaNotaAlvo } from '@/lib/notaMediaAvaliacoes'

function metaObj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw != null && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {}
}

/** Após aceite: se placa vermelha, registra PAX no manifesto diário. */
export async function registrarManifestoAposAceiteCorrida(
  admin: SupabaseClient,
  params: {
    profissionalId: string
    placaVermelha: boolean
    turistaUsuarioId: string
    recomendacaoId: string | null
    destinoEmpresaId: string | null
    solicitacaoId: string
    metadataAtual: unknown
    dataAgendada?: string | null
    dadosPax?: {
      nome: string
      documento: string
      data_nascimento: string
      validada?: boolean
    } | null
  },
): Promise<Record<string, unknown>> {
  const meta = metaObj(params.metadataAtual)
  if (!params.placaVermelha) return meta

  let contratacaoTipo: ContratacaoTipo = 'algoritmo'
  let profissionalIndiretoId: string | null = null

  if (params.recomendacaoId) {
    contratacaoTipo = 'indicacao'
    const { data: rec } = await admin
      .from('recomendacoes_profissional')
      .select('profissional_indicador_id')
      .eq('id', params.recomendacaoId)
      .maybeSingle()
    if (rec?.profissional_indicador_id) {
      profissionalIndiretoId = String(rec.profissional_indicador_id)
    }
  } else if (meta.contratacao_direcionada === true || meta.profissional_fixado_id) {
    contratacaoTipo = 'contratacao_direta'
  } else if (params.dataAgendada || meta.agendamento === true) {
    contratacaoTipo = 'agendamento'
  }

  const dataManifesto = params.dataAgendada
    ? String(params.dataAgendada).slice(0, 10)
    : undefined

  const paradas = params.destinoEmpresaId
    ? filtrarEmpresaIds([params.destinoEmpresaId])
    : []

  const dadosPax = params.dadosPax
    ? {
        nome: params.dadosPax.nome,
        documento: params.dadosPax.documento,
        data_nascimento: params.dadosPax.data_nascimento,
        validada: params.dadosPax.validada !== false,
      }
    : undefined

  const reg = await registrarTuristaNoManifesto(admin, {
    profissionalId: params.profissionalId,
    turistaUsuarioId: params.turistaUsuarioId,
    contratacaoTipo,
    profissionalIndiretoId,
    dataManifesto,
    paradasEmpresaIds: paradas.length ? paradas : undefined,
    dadosPax,
    solicitacaoId: params.solicitacaoId,
  })

  if ('error' in reg) {
    return {
      ...meta,
      manifesto_erro: reg.error,
    }
  }

  return {
    ...meta,
    manifesto_id: reg.manifestoId,
    manifesto_passageiro_id: reg.passageiroId,
    manifesto_contratacao_tipo: contratacaoTipo,
    fase: 'a_caminho',
  }
}

export type ConcluirCorridaResult =
  | {
      ok: true
      status: 'concluida'
      manifestoConcluido: boolean
      manifestoPendenteCheckin?: boolean
      financeiro?: {
        regime: string
        valorCorrida: number
        valorRegular: number
        valorIndicador: number
        bonusVoluntario: number
      }
    }
  | { ok: false; error: string; manifestoPendenteCheckin?: boolean }

/**
 * Conclui a corrida aceita: libera profissional, encerra chat,
 * conclui manifesto (placa vermelha) e gera os recibos financeiros da rota.
 */
export async function concluirCorridaMobilidade(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    profissionalUsuarioId: string
    /** Se true e guia com paradas pendentes, não conclui a corrida. */
    exigirManifestoOk?: boolean
    pagamentoConfirmadoDinheiro?: boolean
    bonusVoluntario?: number
    /** Guia/van: liquidar corridas uma a uma e concluir o manifesto no fim. */
    pularManifesto?: boolean
    /** false = mantém o profissional em atendimento (lote do manifesto). */
    liberarProfissional?: boolean
  },
): Promise<ConcluirCorridaResult> {
  const { data: prof } = await admin
    .from('profissionais')
    .select(
      'id, placa_vermelha, categorias, nome_completo, nome_usuario, foto_perfil_url, foto_url',
    )
    .eq('usuario_id', params.profissionalUsuarioId)
    .maybeSingle()
  if (!prof?.id) return { ok: false, error: 'Profissional não encontrado.' }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select(
      'id, status, profissional_id, metadata, turista_id, origem_nome, destino_nome, valor_estimado, pagamento, lugares, data_agendada, modalidade',
    )
    .eq('id', params.solicitacaoId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Solicitação não encontrada.' }
  if (
    String(row.status) !== 'aceita' &&
    String(row.status) !== 'a_caminho' &&
    String(row.status) !== 'no_local' &&
    String(row.status) !== 'em_viagem'
  ) {
    return { ok: false, error: 'Corrida não está em andamento.' }
  }
  if (String(row.profissional_id) !== String(prof.id)) {
    return { ok: false, error: 'Esta corrida não é sua.' }
  }
  if (!modalidadeUsaDeslocamentoProprio(row.modalidade != null ? String(row.modalidade) : '')) {
    return { ok: false, error: 'Este atendimento é concluído no aplicativo parceiro.' }
  }

  const meta = metaObj(row.metadata)
  const manifestoId = meta.manifesto_id != null ? String(meta.manifesto_id).trim() : ''
  let manifestoConcluido = false
  let manifestoPendenteCheckin = false

  if (manifestoId && Boolean(prof.placa_vermelha) && params.pularManifesto !== true) {
    const man = await concluirManifestoDiario(admin, manifestoId, prof.id)
    if (!man.ok) {
      const msg = String(man.error ?? '')
      const pendente = msg.toLowerCase().includes('check-in')
      if (pendente && params.exigirManifestoOk !== false) {
        return {
          ok: false,
          error: msg,
          manifestoPendenteCheckin: true,
        }
      }
      manifestoPendenteCheckin = pendente
      meta.manifesto_conclusao_erro = msg
    } else {
      manifestoConcluido = true
    }
  }

  const fin = await liquidarComissaoCorridaMobilidade(admin, {
    solicitacaoId: params.solicitacaoId,
    profissionalUsuarioId: params.profissionalUsuarioId,
    profissionalId: String(prof.id),
    metadataAtual: meta,
    pagamentoConfirmadoDinheiro: params.pagamentoConfirmadoDinheiro,
    bonusVoluntario: params.bonusVoluntario,
  })
  if (!fin.ok) return { ok: false, error: fin.error }

  const agora = new Date().toISOString()
  await admin
    .from('solicitacao_mobilidade')
    .update({
      status: 'concluida',
      metadata: {
        ...fin.metadata,
        concluido_em: agora,
        manifesto_concluido: manifestoConcluido,
      },
    })
    .eq('id', params.solicitacaoId)

  if (params.liberarProfissional !== false) {
    await admin
      .from('profissionais')
      .update({
        mobilidade_status: 'online',
        mobilidade_status_em: agora,
      })
      .eq('id', prof.id)
  }

  await encerrarConversaCorrida(admin, params.solicitacaoId)

  const fotoProf =
    prof.foto_perfil_url != null && String(prof.foto_perfil_url).trim()
      ? String(prof.foto_perfil_url)
      : prof.foto_url != null && String(prof.foto_url).trim()
        ? String(prof.foto_url)
        : null

  try {
    await registrarCompraTuristaCorridaMobilidade(admin, {
      turistaUsuarioId: String(row.turista_id),
      solicitacaoId: params.solicitacaoId,
      profissionalUsuarioId: params.profissionalUsuarioId,
      profissionalNome: String(prof.nome_completo ?? 'Profissional'),
      profissionalUsername:
        prof.nome_usuario != null ? String(prof.nome_usuario).replace(/^@+/, '') : null,
      profissionalFotoUrl: fotoProf,
      origemNome: row.origem_nome != null ? String(row.origem_nome) : null,
      destinoNome: row.destino_nome != null ? String(row.destino_nome) : null,
      valor:
        fin.liquidacao.valorCorrida > 0
          ? fin.liquidacao.valorCorrida
          : row.valor_estimado != null
            ? Number(row.valor_estimado)
            : null,
      pagamento: row.pagamento != null ? String(row.pagamento) : null,
      lugares: row.lugares != null ? Number(row.lugares) : null,
      dataAgendada: row.data_agendada != null ? String(row.data_agendada) : null,
      modalidade: row.modalidade != null ? String(row.modalidade) : null,
      concluidoEm: agora,
    })
  } catch {
    /* histórico não bloqueia conclusão */
  }

  return {
    ok: true,
    status: 'concluida',
    manifestoConcluido,
    manifestoPendenteCheckin: manifestoPendenteCheckin || undefined,
    financeiro: {
      regime: fin.liquidacao.regime,
      valorCorrida: fin.liquidacao.valorCorrida,
      valorRegular: fin.liquidacao.valorRegular,
      valorIndicador: fin.liquidacao.valorIndicador,
      bonusVoluntario: fin.liquidacao.bonusVoluntario,
    },
  }
}

/** Corrida ativa do profissional (a caminho / em atendimento). */
export async function buscarCorridaAtivaProfissional(
  admin: SupabaseClient,
  profissionalId: string,
  preferSolicitacaoId?: string | null,
): Promise<{
  solicitacaoId: string
  status: string
  origemNome: string | null
  destinoNome: string | null
  modalidade: string | null
  valorEstimado: number | null
  pagamento: string | null
  lugares: number | null
  dataAgendada: string | null
  conversaId: string | null
  manifestoId: string | null
  latOrigem: number | null
  lngOrigem: number | null
  latDestino: number | null
  lngDestino: number | null
  profLat: number | null
  profLng: number | null
  turista: {
    usuarioId: string
    nome: string
    username: string | null
    fotoUrl: string | null
    verificado: boolean
    notaMedia: number | null
  } | null
} | null> {
  let row: Record<string, unknown> | null = null
  const prefer = String(preferSolicitacaoId ?? '').trim()
  if (prefer) {
    const { data } = await admin
      .from('solicitacao_mobilidade')
      .select(
        'id, status, turista_id, origem_nome, destino_nome, modalidade, valor_estimado, pagamento, lugares, data_agendada, metadata, lat_origem, lng_origem, lat_destino, lng_destino',
      )
      .eq('id', prefer)
      .eq('profissional_id', profissionalId)
      .in('status', ['aceita', 'a_caminho', 'no_local', 'em_viagem'])
      .maybeSingle()
    if (data?.id) row = data as Record<string, unknown>
  }

  if (!row) {
    const { data } = await admin
      .from('solicitacao_mobilidade')
      .select(
        'id, status, turista_id, origem_nome, destino_nome, modalidade, valor_estimado, pagamento, lugares, data_agendada, metadata, lat_origem, lng_origem, lat_destino, lng_destino',
      )
      .eq('profissional_id', profissionalId)
      .in('status', ['aceita', 'a_caminho', 'no_local', 'em_viagem'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    row = data ? (data as Record<string, unknown>) : null
  }

  if (!row?.id) return null

  const { data: prof } = await admin
    .from('profissionais')
    .select('mobilidade_lat, mobilidade_lng')
    .eq('id', profissionalId)
    .maybeSingle()

  const meta = metaObj(row.metadata)
  const { data: conv } = await admin
    .from('mobilidade_conversas')
    .select('id')
    .eq('solicitacao_id', row.id)
    .maybeSingle()

  const numOrNull = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  let turista: {
    usuarioId: string
    nome: string
    username: string | null
    fotoUrl: string | null
    verificado: boolean
    notaMedia: number | null
  } | null = null

  const turistaId = row.turista_id != null ? String(row.turista_id) : ''
  if (turistaId) {
    const { data: tur } = await admin
      .from('turistas')
      .select('nome_completo, nome_usuario, foto_perfil_url, foto_url, docs_verificado')
      .eq('usuario_id', turistaId)
      .maybeSingle()

    const notaMedia = await mediaNotaAlvo(admin, 'turista', [turistaId])

    const foto =
      tur?.foto_perfil_url != null && String(tur.foto_perfil_url).trim()
        ? String(tur.foto_perfil_url)
        : tur?.foto_url != null && String(tur.foto_url).trim()
          ? String(tur.foto_url)
          : null

    turista = {
      usuarioId: turistaId,
      nome: String(tur?.nome_completo ?? 'Turista'),
      username: tur?.nome_usuario != null ? String(tur.nome_usuario).replace(/^@+/, '') : null,
      fotoUrl: foto,
      verificado: Boolean(tur?.docs_verificado),
      notaMedia,
    }
  }

  return {
    solicitacaoId: String(row.id),
    status: String(row.status ?? 'a_caminho'),
    origemNome: row.origem_nome != null ? String(row.origem_nome) : null,
    destinoNome: row.destino_nome != null ? String(row.destino_nome) : null,
    modalidade: row.modalidade != null ? String(row.modalidade) : null,
    valorEstimado: row.valor_estimado != null ? Number(row.valor_estimado) : null,
    pagamento: row.pagamento != null ? String(row.pagamento) : null,
    lugares: row.lugares != null ? Number(row.lugares) : null,
    dataAgendada: row.data_agendada != null ? String(row.data_agendada) : null,
    conversaId: conv?.id != null ? String(conv.id) : null,
    manifestoId: meta.manifesto_id != null ? String(meta.manifesto_id) : null,
    latOrigem: numOrNull(row.lat_origem),
    lngOrigem: numOrNull(row.lng_origem),
    latDestino: numOrNull(row.lat_destino),
    lngDestino: numOrNull(row.lng_destino),
    profLat: numOrNull(prof?.mobilidade_lat),
    profLng: numOrNull(prof?.mobilidade_lng),
    turista,
  }
}
