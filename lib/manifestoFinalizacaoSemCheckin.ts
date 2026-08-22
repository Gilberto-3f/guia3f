import type { SupabaseClient } from '@supabase/supabase-js'

export const FINALIZACAO_OUTRO_MAX = 350

export type MotivoFinalizacaoSemCheckinId = 'cliente_pediu' | 'outro'

export type FinalizacaoSemCheckinMeta = {
  pendente: boolean
  motivo_profissional_id: MotivoFinalizacaoSemCheckinId
  motivo_profissional: string
  proposto_em: string
  motivo_turista?: string | null
  motivo_turista_outro?: string | null
  confirmado_turista_em?: string | null
}

function metaObj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw != null && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {}
}

export function textoMotivoProfissional(
  id: MotivoFinalizacaoSemCheckinId,
  detalhe?: string | null,
): string {
  if (id === 'cliente_pediu') return 'Cliente pediu.'
  return String(detalhe ?? '').trim()
}

export function lerFinalizacaoSemCheckin(metadata: unknown): FinalizacaoSemCheckinMeta | null {
  const meta = metaObj(metadata)
  const raw = meta.finalizacao_sem_checkin
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = String(o.motivo_profissional_id ?? '')
  if (id !== 'cliente_pediu' && id !== 'outro') return null
  return {
    pendente: o.pendente === true,
    motivo_profissional_id: id,
    motivo_profissional: String(o.motivo_profissional ?? ''),
    proposto_em: String(o.proposto_em ?? ''),
    motivo_turista: o.motivo_turista != null ? String(o.motivo_turista) : null,
    motivo_turista_outro: o.motivo_turista_outro != null ? String(o.motivo_turista_outro) : null,
    confirmado_turista_em:
      o.confirmado_turista_em != null ? String(o.confirmado_turista_em) : null,
  }
}

export function validarMotivoProfissional(params: {
  motivo: unknown
  detalhe?: unknown
}):
  | { ok: true; id: MotivoFinalizacaoSemCheckinId; texto: string }
  | { ok: false; error: string } {
  const id = String(params.motivo ?? '').trim()
  if (id !== 'cliente_pediu' && id !== 'outro') {
    return { ok: false, error: 'Selecione um motivo para finalizar.' }
  }
  const detalhe = String(params.detalhe ?? '').trim().slice(0, FINALIZACAO_OUTRO_MAX)
  if (id === 'outro' && !detalhe) {
    return { ok: false, error: 'Descreva o motivo.' }
  }
  return {
    ok: true,
    id,
    texto: textoMotivoProfissional(id, detalhe),
  }
}

async function idsSolicitacoesRecebidas(
  supabase: SupabaseClient,
  manifestoId: string,
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const { data: pax } = await supabase
    .from('manifesto_passageiros')
    .select('id, status, solicitacao_id')
    .eq('manifesto_id', manifestoId)

  const pendentes = (pax ?? []).filter((p) => String(p.status ?? 'pendente') === 'pendente')
  if (pendentes.length > 0) {
    return { ok: false, error: 'Receba ou cancele todos os passageiros antes de concluir.' }
  }

  const ids = (pax ?? [])
    .filter((p) => String(p.status) === 'recebido' && p.solicitacao_id)
    .map((p) => String(p.solicitacao_id))

  if (ids.length === 0) {
    return { ok: false, error: 'Nenhum passageiro recebido para finalizar.' }
  }
  return { ok: true, ids }
}

/** Profissional propõe finalizar sem check-in; turista ainda precisa confirmar. */
export async function proporFinalizacaoSemCheckin(
  supabase: SupabaseClient,
  params: {
    manifestoId: string
    profissionalId: string
    motivoId: MotivoFinalizacaoSemCheckinId
    motivoTexto: string
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

  const rec = await idsSolicitacoesRecebidas(supabase, params.manifestoId)
  if (!rec.ok) return rec

  const agora = new Date().toISOString()
  const bloco: FinalizacaoSemCheckinMeta = {
    pendente: true,
    motivo_profissional_id: params.motivoId,
    motivo_profissional: params.motivoTexto,
    proposto_em: agora,
  }

  const { data: rows } = await supabase
    .from('solicitacao_mobilidade')
    .select('id, metadata')
    .in('id', rec.ids)

  for (const row of rows ?? []) {
    const meta = metaObj(row.metadata)
    const prev = lerFinalizacaoSemCheckin(meta)
    if (prev?.confirmado_turista_em) continue
    meta.finalizacao_sem_checkin = bloco
    const { error } = await supabase
      .from('solicitacao_mobilidade')
      .update({ metadata: meta })
      .eq('id', row.id)
    if (error) return { ok: false, error: error.message }
  }

  return { ok: true }
}

/** Turista confirma (ou registra OUTRO). Se todos confirmaram, o caller conclui o manifesto. */
export async function registrarConfirmacaoTuristaSemCheckin(
  supabase: SupabaseClient,
  params: {
    solicitacaoId: string
    turistaUsuarioId: string
    confirma: boolean
    outroTexto?: string | null
  },
): Promise<
  | { ok: true; manifestoId: string; todosConfirmaram: boolean }
  | { ok: false; error: string }
> {
  const { data: row } = await supabase
    .from('solicitacao_mobilidade')
    .select('id, turista_id, metadata')
    .eq('id', params.solicitacaoId)
    .maybeSingle()

  if (!row?.id) return { ok: false, error: 'Solicitação não encontrada.' }
  if (String(row.turista_id) !== params.turistaUsuarioId) {
    return { ok: false, error: 'Esta corrida não é sua.' }
  }

  const meta = metaObj(row.metadata)
  const fin = lerFinalizacaoSemCheckin(meta)
  if (!fin?.pendente) {
    return { ok: false, error: 'Não há finalização pendente de confirmação.' }
  }
  if (fin.confirmado_turista_em) {
    const manifestoId = meta.manifesto_id != null ? String(meta.manifesto_id) : ''
    if (!manifestoId) return { ok: false, error: 'Manifesto não encontrado.' }
    return { ok: true, manifestoId, todosConfirmaram: false }
  }

  const outro = String(params.outroTexto ?? '')
    .trim()
    .slice(0, FINALIZACAO_OUTRO_MAX)
  if (!params.confirma && !outro) {
    return { ok: false, error: 'Descreva o motivo.' }
  }

  const agora = new Date().toISOString()
  const atualizado: FinalizacaoSemCheckinMeta = {
    ...fin,
    motivo_turista: params.confirma ? 'Confirmo' : 'Outro',
    motivo_turista_outro: params.confirma ? null : outro,
    confirmado_turista_em: agora,
  }
  meta.finalizacao_sem_checkin = atualizado
  meta.finalizacao_sem_checkin_motivo_profissional = fin.motivo_profissional
  meta.finalizacao_sem_checkin_motivo_turista = atualizado.motivo_turista
  if (atualizado.motivo_turista_outro) {
    meta.finalizacao_sem_checkin_motivo_turista_outro = atualizado.motivo_turista_outro
  }

  const { error } = await supabase
    .from('solicitacao_mobilidade')
    .update({ metadata: meta })
    .eq('id', params.solicitacaoId)
  if (error) return { ok: false, error: error.message }

  const manifestoId = meta.manifesto_id != null ? String(meta.manifesto_id) : ''
  if (!manifestoId) return { ok: false, error: 'Manifesto não encontrado.' }

  const rec = await idsSolicitacoesRecebidas(supabase, manifestoId)
  if (!rec.ok) return rec

  const { data: sols } = await supabase
    .from('solicitacao_mobilidade')
    .select('id, metadata')
    .in('id', rec.ids)

  const todosConfirmaram = (sols ?? []).every((s) => {
    const f = lerFinalizacaoSemCheckin(s.metadata)
    return Boolean(f?.confirmado_turista_em)
  })

  return { ok: true, manifestoId, todosConfirmaram }
}
