import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { buscarConfigComissoesAtiva, parProfissionaisOrdenado } from '@/lib/configComissoesRuntime'
import {
  mapParceiroFinanceiroMeta,
  notificarAnfitriaoPropostaParceriaBase,
} from '@/lib/recomendacaoAnfitriaoFinanceiro'
import {
  listarBeneficiosOferta,
  type BeneficiosOfertaRecord,
} from '@/lib/comissoesBeneficiosInfo'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'
import { registrarTuristaNoManifesto, filtrarEmpresaIds, type DadosPaxManifesto } from '@/lib/manifestoDiario'

function rotuloComissaoOferta(beneficios: unknown, categoriaProfissional: string): string {
  const raw =
    beneficios && typeof beneficios === 'object' && !Array.isArray(beneficios)
      ? (beneficios as BeneficiosOfertaRecord)
      : ({} as BeneficiosOfertaRecord)
  const itens = listarBeneficiosOferta(raw)
  if (itens.length > 0) return itens.map((i) => `${i.label} ${i.valor}`).join(', ')
  const cat = String(categoriaProfissional ?? '').trim()
  return cat || 'benefício'
}

export type DadosAtendimentoManifesto = {
  nome_completo: string
  username: string
  documento: string | null
  data_hora_atendimento: string
  ponto_partida: string | null
  atrativos: string[]
}

export type ContratarRecomendacaoResult = {
  ok: boolean
  error?: string
  parceriaId?: string
  manifestoId?: string
}

async function buscarDadosTurista(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
): Promise<DadosAtendimentoManifesto> {
  const [{ data: tur }, { data: usr }] = await Promise.all([
    supabase
      .from('turistas')
      .select('nome_completo, nome_usuario, documento_identidade')
      .eq('usuario_id', turistaUsuarioId)
      .maybeSingle(),
    supabase.from('usuarios').select('email').eq('id', turistaUsuarioId).maybeSingle(),
  ])

  const username = tur?.nome_usuario != null ? String(tur.nome_usuario).replace(/^@+/, '') : ''
  return {
    nome_completo: String(tur?.nome_completo ?? 'Turista'),
    username: username ? `@${username}` : '—',
    documento: tur?.documento_identidade != null ? String(tur.documento_identidade) : null,
    data_hora_atendimento: new Date().toISOString(),
    ponto_partida: null,
    atrativos: [],
  }
}

/**
 * Abre (ou reativa) parceria em andamento a partir de uma recomendação do Ecossistema,
 * sem marcar `contratado_em` — o indicador acompanha se o indicado aceitou.
 */
export async function abrirParceriaEmAndamentoPorRecomendacao(
  supabase: SupabaseClient,
  params: {
    recomendacaoId: string
    indicadorId: string
    indicadoId: string
    turistaUsuarioId: string
  },
): Promise<{ ok: boolean; parceriaId?: string; error?: string }> {
  const [profA, profB] = parProfissionaisOrdenado(params.indicadorId, params.indicadoId)

  const { data: parExistente } = await supabase
    .from('parcerias_profissionais')
    .select('id, status')
    .eq('profissional_a_id', profA)
    .eq('profissional_b_id', profB)
    .maybeSingle()

  if (parExistente?.id) {
    const parceriaId = String(parExistente.id)
    await supabase
      .from('parcerias_profissionais')
      .update({
        status: 'em_andamento',
        recomendacao_id: params.recomendacaoId,
        turista_usuario_id: params.turistaUsuarioId,
      })
      .eq('id', parceriaId)
    return { ok: true, parceriaId }
  }

  const { data: novaPar, error: parErr } = await supabase
    .from('parcerias_profissionais')
    .insert({
      profissional_a_id: profA,
      profissional_b_id: profB,
      status: 'em_andamento',
      recomendacao_id: params.recomendacaoId,
      turista_usuario_id: params.turistaUsuarioId,
    })
    .select('id')
    .maybeSingle()

  if (parErr) return { ok: false, error: parErr.message }
  return {
    ok: true,
    parceriaId: novaPar?.id != null ? String(novaPar.id) : undefined,
  }
}

/**
 * Turista contrata profissional recomendado: registra parceria em andamento,
 * manifesto com dados do turista e avisos no canal financeiro.
 */
export async function processarContratacaoRecomendacaoProfissional(
  supabase: SupabaseClient,
  params: {
    turistaUsuarioId: string
    recomendacaoId: string
    profissionalIndicadoUsuarioId: string
    pontoPartida?: string | null
    atrativos?: string[]
    dadosPax?: DadosPaxManifesto
    /**
     * Guia/van/taxista: manifesto só após ACEITAR na mobilidade (Etapa 7).
     * Ainda marca recomendação + parceria + avisos no canal.
     */
    omitirManifesto?: boolean
  },
): Promise<ContratarRecomendacaoResult> {
  const { turistaUsuarioId, recomendacaoId, profissionalIndicadoUsuarioId } = params

  const { data: rec, error: recErr } = await supabase
    .from('recomendacoes_profissional')
    .select(
      `
      id,
      profissional_indicador_id,
      profissional_indicado_id,
      contratado_em,
      profissional_indicador:profissional_indicador_id (id, usuario_id, nome_completo, nome_usuario, categorias),
      profissional_indicado:profissional_indicado_id (id, usuario_id, nome_completo, nome_usuario, categorias, placa_vermelha)
    `,
    )
    .eq('id', recomendacaoId)
    .maybeSingle()

  if (recErr || !rec) return { ok: false, error: 'Recomendação não encontrada.' }
  if (rec.contratado_em) return { ok: false, error: 'Esta recomendação já foi convertida em contratação.' }

  const indicado = joinSupabaseRow(rec.profissional_indicado)
  const indicador = joinSupabaseRow(rec.profissional_indicador)
  if (!indicado?.usuario_id || String(indicado.usuario_id) !== profissionalIndicadoUsuarioId) {
    return { ok: false, error: 'Profissional não corresponde à recomendação.' }
  }

  const indicadoId = String(indicado.id)
  const indicadorId = String(rec.profissional_indicador_id)
  const indicadorUsuarioId = String(indicador?.usuario_id ?? '')
  const placaVermelha = Boolean(indicado.placa_vermelha)
  const [profA, profB] = parProfissionaisOrdenado(indicadorId, indicadoId)

  const dadosAtendimento = await buscarDadosTurista(supabase, turistaUsuarioId)
  if (params.pontoPartida?.trim()) dadosAtendimento.ponto_partida = params.pontoPartida.trim()
  if (params.atrativos?.length) dadosAtendimento.atrativos = filtrarEmpresaIds(params.atrativos)

  const atrativosIds = filtrarEmpresaIds(params.atrativos ?? [])

  const agora = new Date().toISOString()

  const { error: updRecErr } = await supabase
    .from('recomendacoes_profissional')
    .update({ turista_usuario_id: turistaUsuarioId, contratado_em: agora })
    .eq('id', recomendacaoId)

  if (updRecErr) return { ok: false, error: updRecErr.message }

  let parceriaId: string | undefined

  const { data: parExistente } = await supabase
    .from('parcerias_profissionais')
    .select('id, status')
    .eq('profissional_a_id', profA)
    .eq('profissional_b_id', profB)
    .maybeSingle()

  if (parExistente?.id) {
    parceriaId = String(parExistente.id)
    if (String(parExistente.status) !== 'em_andamento') {
      await supabase
        .from('parcerias_profissionais')
        .update({
          status: 'em_andamento',
          recomendacao_id: recomendacaoId,
          turista_usuario_id: turistaUsuarioId,
        })
        .eq('id', parceriaId)
    }
  } else {
    const { data: novaPar, error: parErr } = await supabase
      .from('parcerias_profissionais')
      .insert({
        profissional_a_id: profA,
        profissional_b_id: profB,
        status: 'em_andamento',
        recomendacao_id: recomendacaoId,
        turista_usuario_id: turistaUsuarioId,
      })
      .select('id')
      .maybeSingle()

    if (parErr) return { ok: false, error: parErr.message }
    parceriaId = novaPar?.id != null ? String(novaPar.id) : undefined
  }

  // Manifesto operacional: placa vermelha — exceto quando o fluxo vai para mobilidade
  // (manifesto só no ACEITAR do profissional).
  let manifestoId: string | undefined
  if (placaVermelha && !params.omitirManifesto) {
    const { data: manifestoRow, error: manErr } = await supabase
      .from('manifesto')
      .insert({
        profissional_id: indicadoId,
        status: 'pendente',
        pax_qtd: 1,
        turista_usuario_id: turistaUsuarioId,
        recomendacao_id: recomendacaoId,
        profissional_indicador_id: indicadorId,
        dados_atendimento: dadosAtendimento,
      })
      .select('id')
      .maybeSingle()

    if (manErr) return { ok: false, error: manErr.message }
    manifestoId = manifestoRow?.id != null ? String(manifestoRow.id) : undefined

    const dataManifesto = dadosAtendimento.data_hora_atendimento.slice(0, 10)

    await registrarTuristaNoManifesto(supabase, {
      profissionalId: indicadoId,
      turistaUsuarioId,
      contratacaoTipo: 'indicacao',
      profissionalIndiretoId: indicadorId,
      dataManifesto,
      paradasEmpresaIds: atrativosIds.length ? atrativosIds : undefined,
      legacyManifestoId: manifestoId ?? null,
      dadosPax: params.dadosPax ?? {
        nome: dadosAtendimento.nome_completo,
        documento: dadosAtendimento.documento,
        username: dadosAtendimento.username,
        validada: false,
      },
    })
  }

  const catsIndicado = Array.isArray(indicado.categorias) ? indicado.categorias.map(String) : []
  const catsIndicador = Array.isArray(indicador?.categorias) ? indicador.categorias.map(String) : []
  const indicadoEhAnfitriao = categoriasIncluemAnfitriao(catsIndicado)
  const indicadorEhAnfitriao = categoriasIncluemAnfitriao(catsIndicador)

  // O recibo 50/50 só é emitido após concluir a rota. Aqui permanece apenas
  // a proposta-base quando um anfitrião recomenda um profissional regular.
  if (!indicadoEhAnfitriao && indicadorEhAnfitriao && indicadorUsuarioId) {
    await notificarAnfitriaoPropostaParceriaBase(supabase, {
      anfitriaoUsuarioId: indicadorUsuarioId,
      recomendacaoId,
      parceriaId,
      colega: mapParceiroFinanceiroMeta(indicado),
    })
  }

  return {
    ok: true,
    parceriaId,
    manifestoId,
  }
}

/** Notifica empresas com ofertas de comissão sobre pagamento dividido entre 2 profissionais. */
export async function notificarEmpresasParceriaComissaoDividida(
  supabase: SupabaseClient,
  params: {
    turistaUsuarioId: string
    indicadorUsuarioId: string
    indicadoUsuarioId: string
    recomendacaoId: string
  },
): Promise<void> {
  const config = await buscarConfigComissoesAtiva(supabase)
  const pctRegular = config.empresa_split.regular
  const pctIndicador = config.empresa_split.indicador

  const { data: ofertas } = await supabase
    .from('comissao_oferta')
    .select(
      'id, empresa_id, categoria_profissional, beneficios, empresas:empresa_id (usuario_id, nome_fantasia)',
    )
    .limit(50)

  const vistos = new Set<string>()
  for (const row of ofertas ?? []) {
    const emp = joinSupabaseRow(row.empresas)
    const empresaUsuarioId = emp?.usuario_id != null ? String(emp.usuario_id) : ''
    if (!empresaUsuarioId || vistos.has(empresaUsuarioId)) continue
    vistos.add(empresaUsuarioId)

    const nomeEmp = String(emp?.nome_fantasia ?? 'Empresa')
    const rotuloBeneficio = rotuloComissaoOferta(
      row.beneficios,
      String(row.categoria_profissional ?? ''),
    )
    await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
      empresaUsuarioId,
      tipo: 'relatorio_parceria',
      titulo: 'Parceria entre profissionais — comissão dividida',
      mensagem: `Parceria formada por recomendação no app. Ao concluir atendimento, ${pctRegular}% da comissão cadastrada (${rotuloBeneficio}) deve ser paga ao profissional que executou o serviço e ${pctIndicador}% ao profissional que prospectou o turista.`,
      comprovanteDetalhes: {
        recomendacao_id: params.recomendacaoId,
        turista_usuario_id: params.turistaUsuarioId,
        prof_indicador_usuario_id: params.indicadorUsuarioId,
        prof_indicado_usuario_id: params.indicadoUsuarioId,
        split_regular_pct: pctRegular,
        split_indicador_pct: pctIndicador,
        empresa_nome: nomeEmp,
        categoria_profissional: String(row.categoria_profissional ?? ''),
      },
    })
  }
}
