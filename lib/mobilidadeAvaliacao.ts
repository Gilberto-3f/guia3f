import type { SupabaseClient } from '@supabase/supabase-js'

function metaObj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw != null && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {}
}

export type AvaliarCorridaResult =
  | { ok: true; avaliacaoId: string }
  | { ok: false; error: string }

/**
 * Registra avaliação mútua pós-corrida e grava id no metadata da solicitação.
 * Turista → profissional via RPC inserir_avaliacao_profissional.
 * Profissional → turista via RPC inserir_avaliacao_turista.
 */
export async function avaliarCorridaMobilidade(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    avaliadorUsuarioId: string
    role: 'turista' | 'profissional' | 'admin'
    nota: number
    feedback?: string | null
  },
): Promise<AvaliarCorridaResult> {
  const nota = Math.round(Number(params.nota))
  if (!Number.isFinite(nota) || nota < 1 || nota > 5) {
    return { ok: false, error: 'Nota inválida (1–5).' }
  }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select('id, status, turista_id, profissional_id, metadata')
    .eq('id', params.solicitacaoId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Solicitação não encontrada.' }
  if (String(row.status) !== 'concluida') {
    return { ok: false, error: 'Só é possível avaliar corrida concluída.' }
  }

  const meta = metaObj(row.metadata)
  const feedback = params.feedback != null ? String(params.feedback).trim() : ''

  if (params.role === 'turista' || (params.role === 'admin' && String(row.turista_id) === params.avaliadorUsuarioId)) {
    if (String(row.turista_id) !== params.avaliadorUsuarioId && params.role !== 'admin') {
      return { ok: false, error: 'Sem permissão.' }
    }
    if (meta.avaliacao_turista_id) {
      return { ok: false, error: 'Você já avaliou esta corrida.' }
    }
    if (!row.profissional_id) return { ok: false, error: 'Profissional não vinculado.' }

    // RPC precisa da sessão do usuário — usamos insert admin espelhando a RPC
    const { data: ja } = await admin
      .from('avaliacoes')
      .select('id')
      .eq('usuario_id', params.avaliadorUsuarioId)
      .eq('alvo_tipo', 'profissional')
      .eq('alvo_id', row.profissional_id)
      .maybeSingle()
    if (ja?.id) {
      // ainda assim vincula à corrida
      await patchMeta(admin, params.solicitacaoId, meta, {
        avaliacao_turista_id: String(ja.id),
        avaliacao_turista_em: new Date().toISOString(),
      })
      return { ok: true, avaliacaoId: String(ja.id) }
    }

    const { data: av, error } = await admin
      .from('avaliacoes')
      .insert({
        usuario_id: params.avaliadorUsuarioId,
        empresa_id: null,
        alvo_id: row.profissional_id,
        alvo_tipo: 'profissional',
        nota,
        feedback: feedback || null,
        avaliador_tipo: 'turista',
      })
      .select('id')
      .maybeSingle()

    if (error || !av?.id) {
      return { ok: false, error: error?.message ?? 'Falha ao salvar avaliação.' }
    }

    await patchMeta(admin, params.solicitacaoId, meta, {
      avaliacao_turista_id: String(av.id),
      avaliacao_turista_em: new Date().toISOString(),
      avaliacao_turista_nota: nota,
    })
    return { ok: true, avaliacaoId: String(av.id) }
  }

  // profissional avalia turista
  const { data: prof } = await admin
    .from('profissionais')
    .select('id')
    .eq('usuario_id', params.avaliadorUsuarioId)
    .maybeSingle()

  if (!prof?.id || String(row.profissional_id) !== String(prof.id)) {
    return { ok: false, error: 'Sem permissão.' }
  }
  if (meta.avaliacao_profissional_id) {
    return { ok: false, error: 'Você já avaliou esta corrida.' }
  }

  const turistaUsuarioId = String(row.turista_id)

  const { data: jaT } = await admin
    .from('avaliacoes')
    .select('id')
    .eq('usuario_id', params.avaliadorUsuarioId)
    .eq('alvo_tipo', 'turista')
    .eq('alvo_id', turistaUsuarioId)
    .maybeSingle()

  if (jaT?.id) {
    await patchMeta(admin, params.solicitacaoId, meta, {
      avaliacao_profissional_id: String(jaT.id),
      avaliacao_profissional_em: new Date().toISOString(),
    })
    return { ok: true, avaliacaoId: String(jaT.id) }
  }

  const { data: av, error } = await admin
    .from('avaliacoes')
    .insert({
      usuario_id: params.avaliadorUsuarioId,
      empresa_id: null,
      alvo_id: turistaUsuarioId,
      alvo_tipo: 'turista',
      nota,
      feedback: feedback || null,
      avaliador_tipo: 'profissional',
    })
    .select('id')
    .maybeSingle()

  if (error || !av?.id) {
    return { ok: false, error: error?.message ?? 'Falha ao salvar avaliação.' }
  }

  await patchMeta(admin, params.solicitacaoId, meta, {
    avaliacao_profissional_id: String(av.id),
    avaliacao_profissional_em: new Date().toISOString(),
    avaliacao_profissional_nota: nota,
  })
  return { ok: true, avaliacaoId: String(av.id) }
}

async function patchMeta(
  admin: SupabaseClient,
  solicitacaoId: string,
  meta: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  await admin
    .from('solicitacao_mobilidade')
    .update({ metadata: { ...meta, ...patch } })
    .eq('id', solicitacaoId)
}

export async function statusAvaliacaoCorrida(
  admin: SupabaseClient,
  solicitacaoId: string,
  viewerUsuarioId: string,
  role: string,
): Promise<{
  podeAvaliar: boolean
  jaAvaliou: boolean
  solicitacaoId: string
  status: string
}> {
  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select('id, status, turista_id, profissional_id, metadata')
    .eq('id', solicitacaoId)
    .maybeSingle()

  if (!row) {
    return { podeAvaliar: false, jaAvaliou: false, solicitacaoId, status: '' }
  }

  const meta = metaObj(row.metadata)
  const st = String(row.status)
  if (st !== 'concluida') {
    return { podeAvaliar: false, jaAvaliou: false, solicitacaoId, status: st }
  }

  if (role === 'turista' && String(row.turista_id) === viewerUsuarioId) {
    const ja = Boolean(meta.avaliacao_turista_id)
    return { podeAvaliar: !ja, jaAvaliou: ja, solicitacaoId, status: st }
  }

  if (role === 'profissional') {
    const { data: p } = await admin
      .from('profissionais')
      .select('id')
      .eq('usuario_id', viewerUsuarioId)
      .maybeSingle()
    if (p?.id && String(row.profissional_id) === String(p.id)) {
      const ja = Boolean(meta.avaliacao_profissional_id)
      return { podeAvaliar: !ja, jaAvaliou: ja, solicitacaoId, status: st }
    }
  }

  return { podeAvaliar: false, jaAvaliou: false, solicitacaoId, status: st }
}
