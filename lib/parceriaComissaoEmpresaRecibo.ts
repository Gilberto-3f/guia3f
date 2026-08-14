import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarConfigComissoesAtiva, parProfissionaisOrdenado } from '@/lib/configComissoesRuntime'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

export const KIND_PARCERIA_COMISSAO_EMPRESA = 'parceria_comissao_empresa'

function percentualConfig(valor: unknown, fallback: number): number {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Math.min(100, Math.max(0, numero)) : fallback
}

export type EmitirReciboParceriaParams = {
  recomendacaoId: string
  parceriaId?: string | null
  indicadoUsuarioId: string
  indicadorUsuarioId: string
  turistaUsuarioId?: string | null
  solicitacaoId?: string | null
  /** Força reemissão mesmo se já emitido (uso interno / testes). */
  forcar?: boolean
}

/**
 * Emite recibos SEPARADOS da rota tabelada: parceria 50/50 das comissões de empresas.
 * Idempotente por parceria (`recibo_comissao_empresa_emitido_em`).
 */
export async function emitirRecibosParceriaComissaoEmpresa(
  supabase: SupabaseClient,
  params: EmitirReciboParceriaParams,
): Promise<{ ok: boolean; skipped?: boolean; parceriaId?: string; error?: string }> {
  const recomendacaoId = String(params.recomendacaoId ?? '').trim()
  const indicadoUsuarioId = String(params.indicadoUsuarioId ?? '').trim()
  const indicadorUsuarioId = String(params.indicadorUsuarioId ?? '').trim()
  if (!recomendacaoId || !indicadoUsuarioId || !indicadorUsuarioId) {
    return { ok: false, error: 'Dados da parceria incompletos.' }
  }
  if (indicadoUsuarioId === indicadorUsuarioId) {
    return { ok: false, error: 'Indicador e indicado não podem ser o mesmo usuário.' }
  }

  const [{ data: indicado }, { data: indicador }] = await Promise.all([
    supabase
      .from('profissionais')
      .select('id, nome_completo, nome_usuario')
      .eq('usuario_id', indicadoUsuarioId)
      .maybeSingle(),
    supabase
      .from('profissionais')
      .select('id, nome_completo, nome_usuario')
      .eq('usuario_id', indicadorUsuarioId)
      .maybeSingle(),
  ])

  if (!indicado?.id || !indicador?.id) {
    return { ok: false, error: 'Profissionais da parceria não encontrados.' }
  }

  const indicadoId = String(indicado.id)
  const indicadorId = String(indicador.id)
  const [profA, profB] = parProfissionaisOrdenado(indicadorId, indicadoId)

  let parceriaId = params.parceriaId != null ? String(params.parceriaId).trim() : ''
  let cedeuFatia = false

  if (parceriaId) {
    const { data: par, error: parErr } = await supabase
      .from('parcerias_profissionais')
      .select('id, cedeu_fatia_empresa_em, recibo_comissao_empresa_emitido_em')
      .eq('id', parceriaId)
      .maybeSingle()
    if (parErr) {
      return { ok: false, error: parErr.message }
    }
    if (!par?.id) {
      parceriaId = ''
    } else {
      cedeuFatia = Boolean(par.cedeu_fatia_empresa_em)
      if (!params.forcar && par.recibo_comissao_empresa_emitido_em) {
        return { ok: true, skipped: true, parceriaId }
      }
    }
  }

  if (!parceriaId) {
    const { data: par, error: parErr } = await supabase
      .from('parcerias_profissionais')
      .select('id, cedeu_fatia_empresa_em, recibo_comissao_empresa_emitido_em')
      .eq('profissional_a_id', profA)
      .eq('profissional_b_id', profB)
      .maybeSingle()
    if (parErr) {
      return { ok: false, error: parErr.message }
    }
    if (par?.id) {
      parceriaId = String(par.id)
      cedeuFatia = Boolean(par.cedeu_fatia_empresa_em)
      if (!params.forcar && par.recibo_comissao_empresa_emitido_em) {
        return { ok: true, skipped: true, parceriaId }
      }
    }
  }

  const config = await buscarConfigComissoesAtiva(supabase)
  let splitRegular = percentualConfig(config.empresa_split?.regular, 50)
  let splitIndicador = percentualConfig(config.empresa_split?.indicador, 50)
  if (cedeuFatia) {
    splitRegular = 0
    splitIndicador = 100
  }

  const nomeIndicador = String(indicador.nome_completo ?? 'Profissional')
  const nomeIndicado = String(indicado.nome_completo ?? 'Profissional')
  const metaBase = {
    kind: KIND_PARCERIA_COMISSAO_EMPRESA,
    recomendacao_id: recomendacaoId,
    parceria_id: parceriaId || null,
    turista_usuario_id: params.turistaUsuarioId ?? null,
    solicitacao_id: params.solicitacaoId ?? null,
    split_regular_pct: splitRegular,
    split_indicador_pct: splitIndicador,
    cedeu_fatia: cedeuFatia,
    base: 'comissoes_empresas',
    nao_inclui_rota_tabelada: true,
  }

  const msgIndicado = cedeuFatia
    ? `Parceria de comissões de empresas reforçada: sua fatia (${percentualConfig(config.empresa_split?.regular, 50)}%) foi cedida a ${nomeIndicador}. Ele passa a receber 100% das comissões de empresas desta parceria. Este recibo não inclui o valor da rota tabelada.`
    : `Parceria de comissões de empresas (separada da rota tabelada): você (executor) recebe ${splitRegular}% e ${nomeIndicador} (quem indicou) recebe ${splitIndicador}% das comissões pagas pelas empresas. Use REFORÇAR PARCERIA para ceder sua fatia ao indicador.`

  const msgIndicador = cedeuFatia
    ? `Parceria reforçada: ${nomeIndicado} cedeu a fatia dele. Você recebe 100% das comissões de empresas desta parceria. Este recibo não inclui a comissão pela venda da rota tabelada.`
    : `Parceria de comissões de empresas (separada da rota tabelada): sua parte é ${splitIndicador}% e a de ${nomeIndicado} (executor) é ${splitRegular}%. Se o colega reforçar a parceria, a fatia dele passa para você.`

  const [reciboIndicado, reciboIndicador] = await Promise.all([
    inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: indicadoUsuarioId,
      tipo: 'extrato_parceria',
      titulo: 'Parceria — comissões de empresas (50/50)',
      mensagem: msgIndicado,
      comprovanteDetalhes: {
        ...metaBase,
        papel: 'indicado',
        pode_reforcar: !cedeuFatia,
        prof_indicador_usuario_id: indicadorUsuarioId,
        prof_indicado_usuario_id: indicadoUsuarioId,
      },
    }),
    inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: indicadorUsuarioId,
      tipo: 'extrato_parceria',
      titulo: 'Parceria — comissões de empresas (50/50)',
      mensagem: msgIndicador,
      comprovanteDetalhes: {
        ...metaBase,
        papel: 'indicador',
        pode_reforcar: false,
        prof_indicador_usuario_id: indicadorUsuarioId,
        prof_indicado_usuario_id: indicadoUsuarioId,
      },
    }),
  ])
  if (!reciboIndicado.ok || !reciboIndicador.ok) {
    return {
      ok: false,
      error:
        reciboIndicado.error ??
        reciboIndicador.error ??
        'Não foi possível emitir os recibos da parceria.',
    }
  }

  const agora = new Date().toISOString()
  if (parceriaId) {
    const { error: markErr } = await supabase
      .from('parcerias_profissionais')
      .update({ recibo_comissao_empresa_emitido_em: agora })
      .eq('id', parceriaId)
    if (markErr) return { ok: false, error: markErr.message }
  }

  return { ok: true, parceriaId: parceriaId || undefined }
}

/**
 * Indicado cede permanentemente sua fatia das comissões de empresa ao indicador (nesta parceria).
 */
export async function reforcarParceriaCederFatiaEmpresa(
  supabase: SupabaseClient,
  params: {
    parceriaId: string
    indicadoUsuarioId: string
  },
): Promise<{ ok: boolean; error?: string; jaCedido?: boolean }> {
  const parceriaId = String(params.parceriaId ?? '').trim()
  const indicadoUsuarioId = String(params.indicadoUsuarioId ?? '').trim()
  if (!parceriaId || !indicadoUsuarioId) {
    return { ok: false, error: 'parceria_id e usuário obrigatórios.' }
  }

  const { data: eu } = await supabase
    .from('profissionais')
    .select('id, nome_completo, nome_usuario')
    .eq('usuario_id', indicadoUsuarioId)
    .maybeSingle()
  if (!eu?.id) return { ok: false, error: 'Profissional não encontrado.' }

  const { data: row, error: rowErr } = await supabase
    .from('parcerias_profissionais')
    .select(
      `
      id, profissional_a_id, profissional_b_id,
      cedeu_fatia_empresa_em, recomendacao_id,
      recomendacao:recomendacao_id (
        profissional_indicador_id, profissional_indicado_id
      )
    `,
    )
    .eq('id', parceriaId)
    .maybeSingle()

  if (rowErr) return { ok: false, error: rowErr.message }
  if (!row?.id) return { ok: false, error: 'Parceria não encontrada.' }

  const profId = String(eu.id)
  const isParte =
    String(row.profissional_a_id) === profId || String(row.profissional_b_id) === profId
  if (!isParte) return { ok: false, error: 'Você não participa desta parceria.' }

  const rec = joinSupabaseRow(row.recomendacao)
  const indicadoIdRec =
    rec?.profissional_indicado_id != null ? String(rec.profissional_indicado_id) : ''
  if (!indicadoIdRec || indicadoIdRec !== profId) {
    return { ok: false, error: 'Apenas o profissional indicado pode reforçar a parceria.' }
  }

  if (row.cedeu_fatia_empresa_em) {
    return { ok: true, jaCedido: true }
  }

  const indicadorIdRec =
    rec?.profissional_indicador_id != null ? String(rec.profissional_indicador_id) : ''
  let indicadorUsuarioId = ''
  if (indicadorIdRec) {
    const { data: ind } = await supabase
      .from('profissionais')
      .select('usuario_id, nome_completo')
      .eq('id', indicadorIdRec)
      .maybeSingle()
    indicadorUsuarioId = ind?.usuario_id != null ? String(ind.usuario_id) : ''
  }
  if (!indicadorUsuarioId) {
    return { ok: false, error: 'Profissional indicador não encontrado.' }
  }

  const agora = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('parcerias_profissionais')
    .update({
      cedeu_fatia_empresa_em: agora,
      cedeu_fatia_empresa_por: indicadoUsuarioId,
    })
    .eq('id', parceriaId)

  if (updErr) return { ok: false, error: updErr.message }

  const nomeIndicado = String(eu.nome_completo ?? 'Profissional')

  // Atualiza o item do canal que disparou o botão (e espelhos da mesma parceria).
  const { data: itens } = await supabase
    .from('canal_financeiro')
    .select('id, comprovante_detalhes, profissional_id')
    .contains('comprovante_detalhes', {
      kind: KIND_PARCERIA_COMISSAO_EMPRESA,
      parceria_id: parceriaId,
    })
    .limit(20)

  for (const item of itens ?? []) {
    const det =
      item.comprovante_detalhes && typeof item.comprovante_detalhes === 'object'
        ? { ...(item.comprovante_detalhes as Record<string, unknown>) }
        : {}
    const papel = String(det.papel ?? '')
    det.cedeu_fatia = true
    det.cedeu_fatia_em = agora
    det.pode_reforcar = false
    det.split_regular_pct = 0
    det.split_indicador_pct = 100
    await supabase
      .from('canal_financeiro')
      .update({
        comprovante_detalhes: det,
        mensagem:
          papel === 'indicado'
            ? `Parceria reforçada em ${new Date(agora).toLocaleString('pt-BR')}: você cedeu sua fatia das comissões de empresas ao indicador. Ele passa a receber 100% nesta parceria.`
            : `Parceria reforçada em ${new Date(agora).toLocaleString('pt-BR')}: ${nomeIndicado} cedeu a fatia dele. Você recebe 100% das comissões de empresas desta parceria.`,
      })
      .eq('id', item.id)
  }

  if (indicadorUsuarioId) {
    await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: indicadorUsuarioId,
      tipo: 'extrato_parceria',
      titulo: 'Parceria reforçada — fatia cedida',
      mensagem: `${nomeIndicado} reforçou a parceria e cedeu a fatia dele nas comissões de empresas. Você passa a receber 100% nesta parceria (sem alterar o recibo da rota tabelada).`,
      comprovanteDetalhes: {
        kind: KIND_PARCERIA_COMISSAO_EMPRESA,
        papel: 'indicador',
        parceria_id: parceriaId,
        recomendacao_id: row.recomendacao_id != null ? String(row.recomendacao_id) : null,
        cedeu_fatia: true,
        cedeu_fatia_em: agora,
        split_regular_pct: 0,
        split_indicador_pct: 100,
        pode_reforcar: false,
        prof_indicador_usuario_id: indicadorUsuarioId,
        prof_indicado_usuario_id: indicadoUsuarioId,
      },
    })
  }

  return { ok: true }
}

/** Resolve indicador/indicado/parceria a partir de uma recomendação (para liquidação). */
export async function resolverPartesRecomendacao(
  supabase: SupabaseClient,
  recomendacaoId: string,
): Promise<{
  recomendacaoId: string
  parceriaId: string | null
  indicadoUsuarioId: string | null
  indicadorUsuarioId: string | null
  indicadoId: string | null
  indicadorId: string | null
} | null> {
  const recId = String(recomendacaoId ?? '').trim()
  if (!recId) return null

  const { data: rec } = await supabase
    .from('recomendacoes_profissional')
    .select(
      `
      id,
      profissional_indicador_id,
      profissional_indicado_id,
      profissional_indicador:profissional_indicador_id (usuario_id),
      profissional_indicado:profissional_indicado_id (usuario_id)
    `,
    )
    .eq('id', recId)
    .maybeSingle()

  if (!rec?.id) return null

  const indicador = joinSupabaseRow(rec.profissional_indicador)
  const indicado = joinSupabaseRow(rec.profissional_indicado)
  const indicadorId = rec.profissional_indicador_id != null ? String(rec.profissional_indicador_id) : null
  const indicadoId = rec.profissional_indicado_id != null ? String(rec.profissional_indicado_id) : null
  const indicadorUsuarioId =
    indicador?.usuario_id != null ? String(indicador.usuario_id) : null
  const indicadoUsuarioId = indicado?.usuario_id != null ? String(indicado.usuario_id) : null

  let parceriaId: string | null = null
  if (indicadorId && indicadoId) {
    const [a, b] = parProfissionaisOrdenado(indicadorId, indicadoId)
    const { data: par } = await supabase
      .from('parcerias_profissionais')
      .select('id')
      .eq('profissional_a_id', a)
      .eq('profissional_b_id', b)
      .maybeSingle()
    if (par?.id) parceriaId = String(par.id)
  }

  return {
    recomendacaoId: recId,
    parceriaId,
    indicadoUsuarioId,
    indicadorUsuarioId,
    indicadoId,
    indicadorId,
  }
}
