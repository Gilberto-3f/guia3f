import type { SupabaseClient } from '@supabase/supabase-js'
import {
  concluirManifestoDiario,
  filtrarEmpresaIds,
  registrarTuristaNoManifesto,
  type ContratacaoTipo,
} from '@/lib/manifestoDiario'
import { encerrarConversaCorrida } from '@/lib/mobilidadeChatCorrida'

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
  }

  const paradas = params.destinoEmpresaId
    ? filtrarEmpresaIds([params.destinoEmpresaId])
    : []

  const reg = await registrarTuristaNoManifesto(admin, {
    profissionalId: params.profissionalId,
    turistaUsuarioId: params.turistaUsuarioId,
    contratacaoTipo,
    profissionalIndiretoId,
    paradasEmpresaIds: paradas.length ? paradas : undefined,
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
  }
}

export type ConcluirCorridaResult =
  | {
      ok: true
      status: 'concluida'
      manifestoConcluido: boolean
      manifestoPendenteCheckin?: boolean
    }
  | { ok: false; error: string; manifestoPendenteCheckin?: boolean }

/**
 * Conclui a corrida aceita: libera profissional, encerra chat,
 * e tenta concluir o manifesto diário (placa vermelha).
 */
export async function concluirCorridaMobilidade(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    profissionalUsuarioId: string
    /** Se true e guia com paradas pendentes, não conclui a corrida. */
    exigirManifestoOk?: boolean
  },
): Promise<ConcluirCorridaResult> {
  const { data: prof } = await admin
    .from('profissionais')
    .select('id, placa_vermelha, categorias')
    .eq('usuario_id', params.profissionalUsuarioId)
    .maybeSingle()
  if (!prof?.id) return { ok: false, error: 'Profissional não encontrado.' }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select('id, status, profissional_id, metadata, turista_id')
    .eq('id', params.solicitacaoId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Solicitação não encontrada.' }
  if (String(row.status) !== 'aceita') {
    return { ok: false, error: 'Corrida não está em andamento.' }
  }
  if (String(row.profissional_id) !== String(prof.id)) {
    return { ok: false, error: 'Esta corrida não é sua.' }
  }

  const meta = metaObj(row.metadata)
  const manifestoId = meta.manifesto_id != null ? String(meta.manifesto_id).trim() : ''
  let manifestoConcluido = false
  let manifestoPendenteCheckin = false

  if (manifestoId && Boolean(prof.placa_vermelha)) {
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

  const agora = new Date().toISOString()
  await admin
    .from('solicitacao_mobilidade')
    .update({
      status: 'concluida',
      metadata: {
        ...meta,
        concluido_em: agora,
        manifesto_concluido: manifestoConcluido,
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

  return {
    ok: true,
    status: 'concluida',
    manifestoConcluido,
    manifestoPendenteCheckin: manifestoPendenteCheckin || undefined,
  }
}

/** Corrida aceita do profissional (para UI de concluir). */
export async function buscarCorridaAtivaProfissional(
  admin: SupabaseClient,
  profissionalId: string,
): Promise<{
  solicitacaoId: string
  origemNome: string | null
  destinoNome: string | null
  modalidade: string | null
  valorEstimado: number | null
  conversaId: string | null
  manifestoId: string | null
} | null> {
  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select(
      'id, origem_nome, destino_nome, modalidade, valor_estimado, metadata',
    )
    .eq('profissional_id', profissionalId)
    .eq('status', 'aceita')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row?.id) return null

  const meta = metaObj(row.metadata)
  const { data: conv } = await admin
    .from('mobilidade_conversas')
    .select('id')
    .eq('solicitacao_id', row.id)
    .maybeSingle()

  return {
    solicitacaoId: String(row.id),
    origemNome: row.origem_nome != null ? String(row.origem_nome) : null,
    destinoNome: row.destino_nome != null ? String(row.destino_nome) : null,
    modalidade: row.modalidade != null ? String(row.modalidade) : null,
    valorEstimado: row.valor_estimado != null ? Number(row.valor_estimado) : null,
    conversaId: conv?.id != null ? String(conv.id) : null,
    manifestoId: meta.manifesto_id != null ? String(meta.manifesto_id) : null,
  }
}
