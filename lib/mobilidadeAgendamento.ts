import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { abrirOuObterConversaCorrida } from '@/lib/mobilidadeChatCorrida'
import { registrarManifestoAposAceiteCorrida } from '@/lib/mobilidadeCorrida'
import {
  ehCancelamentoUltimaHora,
  registrarInfracaoMobilidade,
} from '@/lib/mobilidadeInfracoes'
import type { ModalidadeMobilidadeId } from '@/lib/mobilidadePopupPesquisa'
import type { CidadeTriplice } from '@/lib/mobilidadeRegional'
import { validarRecusaMobilidade } from '@/lib/mobilidadeRecusaJustificativas'

export type AgendamentoMobilidadeInput = {
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
  profissionalFixadoId: string | null
}

/** Corridas com partida a mais de 2h usam fluxo de agendamento. */
export const MOBILIDADE_AGENDAMENTO_MIN_MS = 2 * 60 * 60 * 1000
/** Janela para confirmar após o aviso de 2h. */
export const MOBILIDADE_CONFIRMACAO_TIMEOUT_MS = 45 * 60 * 1000

export function parseDataAgendadaIso(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  // datetime-local → assume local; Date parse handles ISO
  const d = new Date(s.length === 16 ? `${s}:00` : s)
  return Number.isFinite(d.getTime()) ? d : null
}

export function ehAgendamentoFuturo(data: Date | null, agora = Date.now()): boolean {
  if (!data) return false
  return data.getTime() - agora >= MOBILIDADE_AGENDAMENTO_MIN_MS
}

function modalidadeMatcha(
  modalidade: ModalidadeMobilidadeId,
  cats: string[],
  placaVermelha: boolean,
): boolean {
  if (modalidade === 'motorista_app') return false // agendamento só placa vermelha app-local
  if (modalidade === 'van') return cats.includes('van') || (placaVermelha && cats.includes('van'))
  if (modalidade === 'taxista') return cats.includes('taxista')
  if (modalidade === 'guia') return cats.includes('guia')
  return false
}

export type SlotDisponibilidade = {
  id: string
  profissional_id: string
  data: string
  hora_inicio: string
  hora_fim: string
  vagas_total: number
  vagas_ocupadas: number
  vagas_livres: number
  ativo: boolean
}

function dataYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function horaHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Slots com vaga livre no dia (placa vermelha + modalidade). */
export async function buscarSlotsDisponiveis(
  admin: SupabaseClient,
  params: {
    data: Date
    modalidade: ModalidadeMobilidadeId
    lugares: number
    profissionalFixadoId?: string | null
  },
): Promise<
  Array<
    SlotDisponibilidade & {
      nome: string
      username: string | null
      usuario_id: string
    }
  >
> {
  const ymd = dataYmd(params.data)
  const hm = horaHm(params.data)

  let q = admin
    .from('mobilidade_disponibilidade')
    .select(
      'id, profissional_id, data, hora_inicio, hora_fim, vagas_total, vagas_ocupadas, ativo, profissionais!inner(id, usuario_id, nome_completo, nome_usuario, categorias, placa_vermelha)',
    )
    .eq('data', ymd)
    .eq('ativo', true)

  if (params.profissionalFixadoId) {
    q = q.eq('profissional_id', params.profissionalFixadoId)
  }

  const { data, error } = await q
  if (error || !data) return []

  const out: Array<
    SlotDisponibilidade & { nome: string; username: string | null; usuario_id: string }
  > = []

  for (const row of data) {
    const livres = Number(row.vagas_total) - Number(row.vagas_ocupadas)
    if (livres < Math.max(1, params.lugares)) continue

    const hi = String(row.hora_inicio).slice(0, 5)
    const hf = String(row.hora_fim).slice(0, 5)
    if (hm < hi || hm > hf) continue

    const prof = Array.isArray(row.profissionais) ? row.profissionais[0] : row.profissionais
    if (!prof || !Boolean((prof as { placa_vermelha?: boolean }).placa_vermelha)) continue

    const cats = normalizarCategoriasProfissional(
      Array.isArray((prof as { categorias?: unknown }).categorias)
        ? ((prof as { categorias: unknown[] }).categorias as unknown[]).map(String)
        : [],
    )
    if (!modalidadeMatcha(params.modalidade, cats, true)) continue

    out.push({
      id: String(row.id),
      profissional_id: String(row.profissional_id),
      data: String(row.data),
      hora_inicio: hi,
      hora_fim: hf,
      vagas_total: Number(row.vagas_total),
      vagas_ocupadas: Number(row.vagas_ocupadas),
      vagas_livres: livres,
      ativo: Boolean(row.ativo),
      nome: String((prof as { nome_completo?: string }).nome_completo ?? ''),
      username:
        (prof as { nome_usuario?: string | null }).nome_usuario != null
          ? String((prof as { nome_usuario: string }).nome_usuario)
          : null,
      usuario_id: String((prof as { usuario_id: string }).usuario_id),
    })
  }

  out.sort((a, b) => b.vagas_livres - a.vagas_livres)
  return out
}

export async function criarSolicitacaoAgendada(
  admin: SupabaseClient,
  input: AgendamentoMobilidadeInput,
): Promise<
  | {
      ok: true
      solicitacaoId: string
      status: 'agendada'
      oferta: {
        profissionalId: string
        nome: string
        username: string | null
        fotoUrl: string | null
        distanciaKm: number
        expiraEm: string
      }
      backupsOcultos: number
    }
  | { ok: false; error: string }
> {
  const quando = parseDataAgendadaIso(input.dataAgendada)
  if (!quando || !ehAgendamentoFuturo(quando)) {
    return { ok: false, error: 'Data de agendamento inválida (mínimo 2 horas à frente).' }
  }

  if (input.modalidade === 'motorista_app' && !input.cruzamentoFronteira) {
    return {
      ok: false,
      error: 'Agendamento antecipado é só para profissionais da placa vermelha (van, taxista, guia).',
    }
  }

  const slots = await buscarSlotsDisponiveis(admin, {
    data: quando,
    modalidade: input.modalidade,
    lugares: input.lugares,
    profissionalFixadoId: input.profissionalFixadoId,
  })

  if (!slots.length) {
    return {
      ok: false,
      error: input.profissionalFixadoId
        ? 'Este profissional não tem vaga nesse horário. Escolha outra data/hora.'
        : 'Nenhum profissional com vaga nessa data/horário. Tente outro horário ou aguarde novas agendas.',
    }
  }

  const escolhido = slots[0]
  const { data: ocup, error: occErr } = await admin
    .from('mobilidade_disponibilidade')
    .update({
      vagas_ocupadas: escolhido.vagas_ocupadas + Math.max(1, input.lugares),
      updated_at: new Date().toISOString(),
    })
    .eq('id', escolhido.id)
    .eq('vagas_ocupadas', escolhido.vagas_ocupadas)
    .select('id')
    .maybeSingle()

  if (occErr || !ocup?.id) {
    return { ok: false, error: 'Vaga acabou de ser preenchida. Tente novamente.' }
  }

  const { data: row, error } = await admin
    .from('solicitacao_mobilidade')
    .insert({
      turista_id: input.turistaUsuarioId,
      profissional_id: escolhido.profissional_id,
      status: 'agendada',
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
      data_agendada: quando.toISOString(),
      recomendacao_id: input.recomendacaoId,
      disponibilidade_id: escolhido.id,
      oferta_profissional_id: escolhido.profissional_id,
      metadata: {
        agendamento: true,
        slot_id: escolhido.id,
        lugares_reservados: Math.max(1, input.lugares),
        contratacao_direcionada: Boolean(input.profissionalFixadoId),
        profissional_fixado_id: input.profissionalFixadoId,
        recomendacao_id: input.recomendacaoId,
      },
    })
    .select('id')
    .maybeSingle()

  if (error || !row?.id) {
    // rollback vaga
    await admin
      .from('mobilidade_disponibilidade')
      .update({
        vagas_ocupadas: escolhido.vagas_ocupadas,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escolhido.id)
    return { ok: false, error: error?.message ?? 'Falha ao criar agendamento.' }
  }

  await inserirNotificacaoCanalFinanceiroProfissional(admin, {
    profissionalUsuarioId: escolhido.usuario_id,
    tipo: 'mobilidade_agendamento',
    titulo: 'Nova corrida agendada',
    mensagem: `${input.origemNome} → ${input.destinoNome} em ${quando.toLocaleString('pt-BR')}. Confirmação pedida 2h antes.`,
    comprovanteDetalhes: {
      solicitacao_id: row.id,
      data_agendada: quando.toISOString(),
      modalidade: input.modalidade,
      acao: 'agendada',
    },
  })

  return {
    ok: true,
    solicitacaoId: String(row.id),
    status: 'agendada',
    oferta: {
      profissionalId: escolhido.profissional_id,
      nome: escolhido.nome,
      username: escolhido.username,
      fotoUrl: null,
      distanciaKm: 0,
      expiraEm: '',
    },
    backupsOcultos: Math.max(0, slots.length - 1),
  }
}

async function liberarVaga(
  admin: SupabaseClient,
  disponibilidadeId: string | null,
  lugares: number,
): Promise<void> {
  if (!disponibilidadeId) return
  const { data: slot } = await admin
    .from('mobilidade_disponibilidade')
    .select('vagas_ocupadas')
    .eq('id', disponibilidadeId)
    .maybeSingle()
  if (!slot) return
  const next = Math.max(0, Number(slot.vagas_ocupadas) - Math.max(1, lugares))
  await admin
    .from('mobilidade_disponibilidade')
    .update({ vagas_ocupadas: next, updated_at: new Date().toISOString() })
    .eq('id', disponibilidadeId)
}

export async function cancelarAgendamentoMobilidade(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    actorUsuarioId: string
    role: 'turista' | 'profissional' | 'admin'
    tentarRematch?: boolean
    justificativa?: string | null
    justificativaDetalhe?: string | null
  },
): Promise<{ ok: boolean; error?: string; rematchSolicitacaoId?: string | null }> {
  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select('*')
    .eq('id', params.solicitacaoId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Solicitação não encontrada.' }
  const st = String(row.status)
  if (st !== 'agendada' && st !== 'aguardando_confirmacao') {
    return { ok: false, error: 'Só é possível cancelar agendamentos pendentes.' }
  }

  if (params.role === 'turista' && String(row.turista_id) !== params.actorUsuarioId) {
    return { ok: false, error: 'Sem permissão.' }
  }
  if (params.role === 'profissional') {
    const { data: p } = await admin
      .from('profissionais')
      .select('id, usuario_id')
      .eq('usuario_id', params.actorUsuarioId)
      .maybeSingle()
    if (!p?.id || String(row.profissional_id) !== String(p.id)) {
      return { ok: false, error: 'Sem permissão.' }
    }
  }

  let entradaRecusa: {
    profissional_id?: string
    justificativa: string
    detalhe: string | null
    em: string
  } | null = null

  if (params.role === 'profissional') {
    const validacao = validarRecusaMobilidade({
      justificativa: params.justificativa,
      detalhe: params.justificativaDetalhe,
    })
    if (!validacao.ok) {
      return { ok: false, error: validacao.error }
    }
    entradaRecusa = {
      profissional_id: row.profissional_id != null ? String(row.profissional_id) : undefined,
      justificativa: validacao.id,
      detalhe: validacao.detalhe,
      em: new Date().toISOString(),
    }
  }

  const lugares = Math.max(1, Number(row.lugares) || 1)
  await liberarVaga(
    admin,
    row.disponibilidade_id != null ? String(row.disponibilidade_id) : null,
    lugares,
  )

  const agora = new Date().toISOString()
  const late = ehCancelamentoUltimaHora(
    row.data_agendada != null ? String(row.data_agendada) : null,
  )

  const metaAtual =
    typeof row.metadata === 'object' && row.metadata ? (row.metadata as Record<string, unknown>) : {}
  const historicoRecusas = Array.isArray(metaAtual.historico_recusas)
    ? [...(metaAtual.historico_recusas as unknown[])]
    : []
  if (entradaRecusa) historicoRecusas.push(entradaRecusa)

  await admin
    .from('solicitacao_mobilidade')
    .update({
      status: 'cancelada',
      metadata: {
        ...metaAtual,
        cancelado_em: agora,
        cancelado_por: params.role,
        cancelamento_ultima_hora: late,
        ...(entradaRecusa
          ? {
              ultima_recusa: entradaRecusa,
              historico_recusas: historicoRecusas,
            }
          : {}),
      },
    })
    .eq('id', params.solicitacaoId)

  // Infrações (catálogo ADM existente)
  if (late && params.role === 'turista') {
    await registrarInfracaoMobilidade(admin, {
      usuarioId: String(row.turista_id),
      categoria: 'turista',
      seed: 'turistaNoShow',
      solicitacaoId: params.solicitacaoId,
      detalhe: 'Cancelamento de agendamento perto da partida',
    })
  }
  if (late && params.role === 'profissional') {
    await registrarInfracaoMobilidade(admin, {
      usuarioId: params.actorUsuarioId,
      categoria: 'profissional',
      seed: 'profCancelUltimaHora',
      solicitacaoId: params.solicitacaoId,
      detalhe: 'Profissional cancelou agendamento perto da partida',
    })
  }
  if (params.role === 'admin' && row.profissional_id) {
    // timeout de confirmação (cron)
    const { data: p } = await admin
      .from('profissionais')
      .select('usuario_id')
      .eq('id', row.profissional_id)
      .maybeSingle()
    if (p?.usuario_id) {
      await registrarInfracaoMobilidade(admin, {
        usuarioId: String(p.usuario_id),
        categoria: 'profissional',
        seed: 'profCancelUltimaHora',
        solicitacaoId: params.solicitacaoId,
        detalhe: 'Não confirmou agendamento no prazo (2h)',
      })
    }
  }

  // notificar o outro lado (profissional)
  if (row.profissional_id && params.role === 'turista') {
    const { data: p } = await admin
      .from('profissionais')
      .select('usuario_id')
      .eq('id', row.profissional_id)
      .maybeSingle()
    if (p?.usuario_id) {
      await inserirNotificacaoCanalFinanceiroProfissional(admin, {
        profissionalUsuarioId: String(p.usuario_id),
        tipo: 'mobilidade_agendamento',
        titulo: 'Agendamento cancelado pelo turista',
        mensagem: `${row.origem_nome ?? '—'} → ${row.destino_nome ?? '—'}`,
        comprovanteDetalhes: { solicitacao_id: params.solicitacaoId, acao: 'cancelada_turista' },
      })
    }
  }

  let rematchId: string | null = null
  if (params.tentarRematch && params.role === 'profissional') {
    const quando = row.data_agendada ? new Date(String(row.data_agendada)) : null
    if (quando && ehAgendamentoFuturo(quando)) {
      const input: AgendamentoMobilidadeInput = {
        turistaUsuarioId: String(row.turista_id),
        modalidade: String(row.modalidade) as ModalidadeMobilidadeId,
        origemNome: String(row.origem_nome ?? 'Origem'),
        destinoNome: String(row.destino_nome ?? 'Destino'),
        origemLat: row.lat_origem != null ? Number(row.lat_origem) : null,
        origemLng: row.lng_origem != null ? Number(row.lng_origem) : null,
        destinoLat: row.lat_destino != null ? Number(row.lat_destino) : null,
        destinoLng: row.lng_destino != null ? Number(row.lng_destino) : null,
        destinoEmpresaId: row.destino_empresa_id != null ? String(row.destino_empresa_id) : null,
        cruzamentoFronteira: Boolean(row.cruzamento_fronteira),
        cidadeOrigem: null,
        valorEstimado: row.valor_estimado != null ? Number(row.valor_estimado) : null,
        pagamento: row.pagamento != null ? String(row.pagamento) : null,
        lugares,
        acompanhamentoGuia: Boolean(row.acompanhamento_guia),
        dataAgendada: quando.toISOString(),
        recomendacaoId: row.recomendacao_id != null ? String(row.recomendacao_id) : null,
        profissionalFixadoId: null,
      }
      const novo = await criarSolicitacaoAgendada(admin, input)
      if (novo.ok) rematchId = novo.solicitacaoId
    }
  }

  return { ok: true, rematchSolicitacaoId: rematchId }
}

export async function confirmarAgendamentoMobilidade(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    profissionalUsuarioId: string
    dadosPax?: {
      nome_completo: string
      data_nascimento: string
      documento: string
    } | null
  },
): Promise<{ ok: boolean; error?: string; conversaId?: string | null }> {
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

  if (!row) return { ok: false, error: 'Solicitação não encontrada.' }
  if (String(row.profissional_id) !== String(prof.id)) {
    return { ok: false, error: 'Este agendamento não é seu.' }
  }
  if (String(row.status) !== 'aguardando_confirmacao' && String(row.status) !== 'agendada') {
    return { ok: false, error: 'Agendamento não está aguardando confirmação.' }
  }

  const agora = new Date().toISOString()
  const pax = params.dadosPax
  // Manifesto (guia/van): dados vêm do cadastro do turista quando dadosPax não é enviado.

  const metaBase = {
    ...(typeof row.metadata === 'object' && row.metadata ? row.metadata : {}),
    confirmado_em: agora,
    agendamento: true,
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
    dadosPax: pax
      ? {
          nome: pax.nome_completo,
          documento: pax.documento,
          data_nascimento: pax.data_nascimento,
          validada: true,
        }
      : null,
  })

  await admin
    .from('solicitacao_mobilidade')
    .update({
      status: 'a_caminho',
      confirmacao_expira_em: null,
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

  return {
    ok: true,
    conversaId: 'error' in chat ? null : chat.conversaId,
  }
}

/** Cron: pede confirmação 2h antes; expira confirmações sem resposta. */
export async function processarConfirmacoesAgendamento(
  admin: SupabaseClient,
): Promise<{ pedidas: number; expiradas: number }> {
  const agora = Date.now()
  const em2h = new Date(agora + MOBILIDADE_AGENDAMENTO_MIN_MS).toISOString()
  const agoraIso = new Date(agora).toISOString()

  let pedidas = 0
  let expiradas = 0

  const { data: proximas } = await admin
    .from('solicitacao_mobilidade')
    .select('id, profissional_id, origem_nome, destino_nome, data_agendada')
    .eq('status', 'agendada')
    .not('data_agendada', 'is', null)
    .lte('data_agendada', em2h)
    .gte('data_agendada', agoraIso)
    .limit(50)

  for (const row of proximas ?? []) {
    const expira = new Date(agora + MOBILIDADE_CONFIRMACAO_TIMEOUT_MS).toISOString()
    await admin
      .from('solicitacao_mobilidade')
      .update({
        status: 'aguardando_confirmacao',
        confirmacao_expira_em: expira,
      })
      .eq('id', row.id)

    if (row.profissional_id) {
      const { data: p } = await admin
        .from('profissionais')
        .select('usuario_id')
        .eq('id', row.profissional_id)
        .maybeSingle()
      if (p?.usuario_id) {
        await inserirNotificacaoCanalFinanceiroProfissional(admin, {
          profissionalUsuarioId: String(p.usuario_id),
          tipo: 'mobilidade_agendamento',
          titulo: 'Confirme a corrida agendada (2h)',
          mensagem: `${row.origem_nome ?? '—'} → ${row.destino_nome ?? '—'}. Responda em até 45 min.`,
          comprovanteDetalhes: {
            solicitacao_id: row.id,
            acao: 'aguardando_confirmacao',
            confirmacao_expira_em: expira,
          },
        })
      }
    }
    pedidas += 1
  }

  const { data: vencidas } = await admin
    .from('solicitacao_mobilidade')
    .select('id')
    .eq('status', 'aguardando_confirmacao')
    .not('confirmacao_expira_em', 'is', null)
    .lt('confirmacao_expira_em', agoraIso)
    .limit(50)

  for (const row of vencidas ?? []) {
    await cancelarAgendamentoMobilidade(admin, {
      solicitacaoId: String(row.id),
      actorUsuarioId: '00000000-0000-0000-0000-000000000000',
      role: 'admin',
      tentarRematch: true,
    })
    expiradas += 1
  }

  return { pedidas, expiradas }
}
