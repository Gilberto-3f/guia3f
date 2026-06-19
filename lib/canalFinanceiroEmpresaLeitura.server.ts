import type { SupabaseClient } from '@supabase/supabase-js'
import {
  itemCanalFinanceiroContaComoNaoLidoEmpresa,
  type CanalFinanceiroRowEmpresa,
} from '@/lib/canaisEmpresaVisibilidade'
import { metadataDegustacaoCanal } from '@/lib/degustacaoEmpresa'

function detalhesCanal(row: CanalFinanceiroRowEmpresa): Record<string, unknown> {
  if (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)) {
    return row.metadata
  }
  if (
    row.comprovante_detalhes &&
    typeof row.comprovante_detalhes === 'object' &&
    !Array.isArray(row.comprovante_detalhes)
  ) {
    return row.comprovante_detalhes
  }
  return {}
}

function mesclarVisualizadoMetadata(atual: Record<string, unknown>): Record<string, unknown> {
  return { ...atual, visualizado_em: new Date().toISOString() }
}

/** Sincroniza canal_financeiro de degustações já aceitas/encerradas (badge não deve voltar). */
export async function repararLeituraDegustacaoConcluidaEmpresa(
  admin: SupabaseClient,
  empresaId: string,
): Promise<void> {
  if (!empresaId) return

  const { data: degs, error } = await admin
    .from('empresa_degustacoes')
    .select('id, status, canal_financeiro_id, aceito_em, expira_em, dias, plano_id, planos ( nome, titulo )')
    .eq('empresa_id', empresaId)
    .neq('status', 'aguardando_aceite')
    .not('canal_financeiro_id', 'is', null)

  if (error) {
    console.error('repararLeituraDegustacaoConcluidaEmpresa:', error)
    return
  }

  for (const deg of degs ?? []) {
    const canalId = deg.canal_financeiro_id != null ? String(deg.canal_financeiro_id) : ''
    if (!canalId) continue

    const planosJoin = deg.planos as { nome?: string; titulo?: string } | { nome?: string; titulo?: string }[] | null
    const planoInfo = Array.isArray(planosJoin) ? planosJoin[0] : planosJoin
    const planoTitulo = String(planoInfo?.titulo ?? planoInfo?.nome ?? 'Plano')
    const planoNome = String(planoInfo?.nome ?? planoTitulo)
    const status = String(deg.status ?? 'ativa')
    const aceitoEm = deg.aceito_em != null ? String(deg.aceito_em) : new Date().toISOString()

    const detalhes = metadataDegustacaoCanal({
      degustacaoId: String(deg.id),
      dias: Number(deg.dias ?? 0) || 1,
      planoId: deg.plano_id != null ? String(deg.plano_id) : '',
      planoTitulo,
      planoNome,
      aceito: status === 'ativa' || status === 'expirada',
      aceitoEm: status === 'ativa' || status === 'expirada' ? aceitoEm : undefined,
      expiraEm: deg.expira_em != null ? String(deg.expira_em) : undefined,
    })

    const meta = {
      ...detalhes,
      status,
      visualizado_em: aceitoEm,
    }

    const { error: upErr } = await admin
      .from('canal_financeiro')
      .update({
        lida_por_empresa: true,
        metadata: meta,
        comprovante_detalhes: meta,
      })
      .eq('id', canalId)
      .eq('empresa_id', empresaId)

    if (upErr) console.error('repararLeituraDegustacaoConcluidaEmpresa update:', upErr)
  }
}

/** Persiste leitura no canal financeiro da empresa (service role — ignora falhas de RLS do cliente). */
export async function persistirLeituraCanalFinanceiroEmpresa(
  admin: SupabaseClient,
  empresaId: string,
  itemId?: string,
): Promise<boolean> {
  if (!empresaId) return false

  await repararLeituraDegustacaoConcluidaEmpresa(admin, empresaId)

  let query = admin
    .from('canal_financeiro')
    .select('id, tipo, metadata, comprovante_detalhes, lida_por_empresa')
    .eq('empresa_id', empresaId)

  if (itemId) query = query.eq('id', itemId)

  const { data: rows, error: selErr } = await query
  if (selErr) {
    console.error('persistirLeituraCanalFinanceiroEmpresa select:', selErr)
    return false
  }

  const alvos = (rows ?? []).filter((r) =>
    itemCanalFinanceiroContaComoNaoLidoEmpresa(r as CanalFinanceiroRowEmpresa),
  )

  if (alvos.length === 0) return true

  for (const row of alvos) {
    const id = String(row.id)
    const tipo = String(row.tipo ?? '')
    const patch: Record<string, unknown> = { lida_por_empresa: true }
    if (tipo === 'degustacao_plano') {
      const meta = mesclarVisualizadoMetadata(detalhesCanal(row as CanalFinanceiroRowEmpresa))
      patch.metadata = meta
      patch.comprovante_detalhes = meta
    }

    const { error: upErr } = await admin.from('canal_financeiro').update(patch).eq('id', id).eq('empresa_id', empresaId)
    if (upErr) {
      console.error('persistirLeituraCanalFinanceiroEmpresa update:', upErr)
      return false
    }
  }

  return true
}
