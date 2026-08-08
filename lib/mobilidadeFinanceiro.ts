import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarConfigComissoesAtiva } from '@/lib/configComissoesRuntime'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'

export type RegimeFinanceiroMobilidade = 'tabelada' | 'urbana'

export type LiquidacaoCorridaResult = {
  regime: RegimeFinanceiroMobilidade
  valorCorrida: number
  pool: number
  valorRegular: number
  valorIndicador: number
  valorPlataforma: number
  taxaPct: number
  bonusVoluntario: number
  canalIds: string[]
  pagamentoInformado: string
  pagamentoConfirmadoDinheiro: boolean
}

function money(n: number): number {
  return Math.round(n * 100) / 100
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Liquida comissão da corrida (v1: dinheiro + extrato no canal).
 * Tabelada: taxa ADM sobre valor_estimado + split regular/indicador/plataforma.
 * Urbana (motorista_app sem fronteira): taxa 0 — só registra metadata.
 */
export async function liquidarComissaoCorridaMobilidade(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    profissionalUsuarioId: string
    profissionalId: string
    metadataAtual: Record<string, unknown>
    pagamentoConfirmadoDinheiro?: boolean
    bonusVoluntario?: number
  },
): Promise<{ ok: true; liquidacao: LiquidacaoCorridaResult; metadata: Record<string, unknown> } | { ok: false; error: string }> {
  if (params.metadataAtual.financeiro_liquidado_em) {
    return {
      ok: true,
      liquidacao: {
        regime: (params.metadataAtual.financeiro_regime as RegimeFinanceiroMobilidade) || 'tabelada',
        valorCorrida: Number(params.metadataAtual.financeiro_valor_corrida) || 0,
        pool: Number(params.metadataAtual.financeiro_pool) || 0,
        valorRegular: Number(params.metadataAtual.financeiro_valor_regular) || 0,
        valorIndicador: Number(params.metadataAtual.financeiro_valor_indicador) || 0,
        valorPlataforma: Number(params.metadataAtual.financeiro_valor_plataforma) || 0,
        taxaPct: Number(params.metadataAtual.financeiro_taxa_pct) || 0,
        bonusVoluntario: Number(params.metadataAtual.financeiro_bonus_voluntario) || 0,
        canalIds: Array.isArray(params.metadataAtual.financeiro_canal_ids)
          ? (params.metadataAtual.financeiro_canal_ids as string[])
          : [],
        pagamentoInformado: String(params.metadataAtual.pagamento_informado ?? 'dinheiro'),
        pagamentoConfirmadoDinheiro: Boolean(params.metadataAtual.pagamento_confirmado_dinheiro),
      },
      metadata: params.metadataAtual,
    }
  }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select(
      'id, valor_estimado, pagamento, cruzamento_fronteira, modalidade, recomendacao_id, origem_nome, destino_nome, turista_id',
    )
    .eq('id', params.solicitacaoId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Solicitação não encontrada.' }

  const valorCorrida = money(Number(row.valor_estimado) || 0)
  const pagamentoInformado = String(row.pagamento ?? 'dinheiro').trim() || 'dinheiro'
  const modalidade = String(row.modalidade ?? '')
  const fronteira = Boolean(row.cruzamento_fronteira)
  const urbana = modalidade === 'motorista_app' && !fronteira

  const cfg = await buscarConfigComissoesAtiva(admin)
  const canalIds: string[] = []
  const bonusVoluntario = money(Math.max(0, Number(params.bonusVoluntario) || 0))
  const pagamentoConfirmadoDinheiro =
    params.pagamentoConfirmadoDinheiro === true || pagamentoInformado === 'dinheiro'

  let regime: RegimeFinanceiroMobilidade = urbana ? 'urbana' : 'tabelada'
  let taxaPct = 0
  let pool = 0
  let valorRegular = 0
  let valorIndicador = 0
  let valorPlataforma = 0
  let splitRegular = 0
  let splitIndicador = 0
  let splitPlataforma = 0

  if (urbana) {
    taxaPct = Number(cfg.mobilidade_urbana?.taxa) || 0
    regime = 'urbana'
  } else {
    const t = cfg.mobilidade_tabelada
    taxaPct = Number(t?.taxa) || 0
    splitRegular = Number(t?.regular) || 0
    splitIndicador = Number(t?.indicador) || 0
    splitPlataforma = Number(t?.plataforma) || 0
    pool = money((valorCorrida * taxaPct) / 100)
    valorPlataforma = money((pool * splitPlataforma) / 100)

    let indicadorUsuarioId: string | null = null
    const recId = row.recomendacao_id != null ? String(row.recomendacao_id) : ''
    if (recId) {
      const { data: rec } = await admin
        .from('recomendacoes_profissional')
        .select('profissional_indicador_id')
        .eq('id', recId)
        .maybeSingle()
      if (rec?.profissional_indicador_id) {
        const { data: indProf } = await admin
          .from('profissionais')
          .select('usuario_id')
          .eq('id', rec.profissional_indicador_id)
          .maybeSingle()
        if (indProf?.usuario_id) indicadorUsuarioId = String(indProf.usuario_id)
      }
    }

    if (indicadorUsuarioId) {
      valorRegular = money((pool * splitRegular) / 100)
      valorIndicador = money((pool * splitIndicador) / 100)
    } else {
      // Sem indicação: regular fica com regular+indicador do pool
      valorRegular = money((pool * (splitRegular + splitIndicador)) / 100)
      valorIndicador = 0
    }

    const rota = `${row.origem_nome ?? '—'} → ${row.destino_nome ?? '—'}`

    if (valorRegular > 0 || pool === 0) {
      const rRegular = await inserirNotificacaoCanalFinanceiroProfissional(admin, {
        profissionalUsuarioId: params.profissionalUsuarioId,
        tipo: 'extrato_comissao',
        titulo: 'Resumo da corrida — comissão',
        mensagem: `Resumo da corrida: ${rota}. Valor ${formatBrl(valorCorrida)}. Sua parte na taxa (${taxaPct}%): ${formatBrl(valorRegular)}. Pagamento: ${pagamentoInformado}.`,
        valor: valorRegular,
        comprovanteDetalhes: {
          kind: 'mobilidade_corrida',
          solicitacao_id: params.solicitacaoId,
          regime: 'tabelada',
          papel: 'regular',
          valor_corrida: valorCorrida,
          taxa_pct: taxaPct,
          pool,
          split_regular_pct: splitRegular,
          split_indicador_pct: splitIndicador,
          split_plataforma_pct: splitPlataforma,
          valor_regular: valorRegular,
          valor_indicador: valorIndicador,
          valor_plataforma: valorPlataforma,
          pagamento: pagamentoInformado,
          pagamento_confirmado_dinheiro: pagamentoConfirmadoDinheiro,
          bonus_voluntario: bonusVoluntario,
          recomendacao_id: recId || null,
          origem_nome: row.origem_nome,
          destino_nome: row.destino_nome,
        },
      })
      if (rRegular.id) canalIds.push(rRegular.id)
    }

    if (indicadorUsuarioId && valorIndicador > 0) {
      const rInd = await inserirNotificacaoCanalFinanceiroProfissional(admin, {
        profissionalUsuarioId: indicadorUsuarioId,
        tipo: 'extrato_parceria',
        titulo: 'Resumo da corrida — parceria',
        mensagem: `Resumo da corrida: ${rota}. Sua parte na taxa (${taxaPct}%): ${formatBrl(valorIndicador)}.`,
        valor: valorIndicador,
        comprovanteDetalhes: {
          kind: 'mobilidade_corrida',
          solicitacao_id: params.solicitacaoId,
          regime: 'tabelada',
          papel: 'indicador',
          valor_corrida: valorCorrida,
          taxa_pct: taxaPct,
          pool,
          valor_indicador: valorIndicador,
          pagamento: pagamentoInformado,
          recomendacao_id: recId,
          profissional_regular_usuario_id: params.profissionalUsuarioId,
          origem_nome: row.origem_nome,
          destino_nome: row.destino_nome,
        },
      })
      if (rInd.id) canalIds.push(rInd.id)
    }
  }

  if (bonusVoluntario > 0) {
    const rBonus = await inserirNotificacaoCanalFinanceiroProfissional(admin, {
      profissionalUsuarioId: params.profissionalUsuarioId,
      tipo: 'extrato_comissao',
      titulo: 'Resumo da corrida — bônus',
      mensagem: `Resumo da corrida: turista ofereceu bônus de ${formatBrl(bonusVoluntario)} (fora da taxa da plataforma).`,
      valor: bonusVoluntario,
      comprovanteDetalhes: {
        kind: 'mobilidade_bonus_voluntario',
        solicitacao_id: params.solicitacaoId,
        bonus_voluntario: bonusVoluntario,
      },
    })
    if (rBonus.id) canalIds.push(rBonus.id)
  }

  if (urbana) {
    const rotaUrb = `${row.origem_nome ?? '—'} → ${row.destino_nome ?? '—'}`
    const rUrb = await inserirNotificacaoCanalFinanceiroProfissional(admin, {
      profissionalUsuarioId: params.profissionalUsuarioId,
      tipo: 'extrato_comissao',
      titulo: 'Resumo da corrida — urbana',
      mensagem: `Resumo da corrida: ${rotaUrb}. Modalidade app urbano — taxa ${taxaPct}%. Valor informado: ${formatBrl(valorCorrida)}.`,
      valor: valorCorrida > 0 ? valorCorrida : null,
      comprovanteDetalhes: {
        kind: 'mobilidade_corrida',
        solicitacao_id: params.solicitacaoId,
        regime: 'urbana',
        taxa_pct: taxaPct,
        valor_corrida: valorCorrida,
        pagamento: pagamentoInformado,
        origem_nome: row.origem_nome,
        destino_nome: row.destino_nome,
      },
    })
    if (rUrb.id) canalIds.push(rUrb.id)
  }

  const agora = new Date().toISOString()
  const liquidacao: LiquidacaoCorridaResult = {
    regime,
    valorCorrida,
    pool,
    valorRegular,
    valorIndicador,
    valorPlataforma,
    taxaPct,
    bonusVoluntario,
    canalIds,
    pagamentoInformado,
    pagamentoConfirmadoDinheiro,
  }

  const metadata = {
    ...params.metadataAtual,
    financeiro_liquidado_em: agora,
    financeiro_regime: regime,
    financeiro_valor_corrida: valorCorrida,
    financeiro_pool: pool,
    financeiro_valor_regular: valorRegular,
    financeiro_valor_indicador: valorIndicador,
    financeiro_valor_plataforma: valorPlataforma,
    financeiro_taxa_pct: taxaPct,
    financeiro_bonus_voluntario: bonusVoluntario,
    financeiro_canal_ids: canalIds,
    pagamento_informado: pagamentoInformado,
    pagamento_confirmado_dinheiro: pagamentoConfirmadoDinheiro,
  }

  return { ok: true, liquidacao, metadata }
}
