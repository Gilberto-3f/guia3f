import type { SupabaseClient } from '@supabase/supabase-js'

export type TipoNotificacaoFinanceiroEmpresa =
  | 'mensagem_adm'
  | 'comprovante_pagamento'
  | 'relatorio_pax'
  | 'relatorio_parceria'
  | 'extrato_comissao_paga'
  | 'pagamento_pendente'
  | 'plano_assinatura'
  | 'degustacao_plano'

export type InserirNotificacaoFinanceiroEmpresaParams = {
  empresaUsuarioId: string
  tipo: TipoNotificacaoFinanceiroEmpresa
  titulo: string
  mensagem?: string | null
  valor?: number | null
  anexoUrl?: string | null
  comprovanteDetalhes?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

/**
 * Cria linha no canal financeiro privado da empresa (avisos ADM / sistema).
 */
export async function inserirNotificacaoCanalFinanceiroEmpresa(
  supabase: SupabaseClient,
  params: InserirNotificacaoFinanceiroEmpresaParams
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('id')
    .eq('usuario_id', params.empresaUsuarioId)
    .maybeSingle()

  if (empErr || !emp?.id) {
    return { ok: false, error: empErr?.message ?? 'Empresa não encontrada.' }
  }

  const row: Record<string, unknown> = {
    empresa_id: emp.id,
    profissional_id: null,
    tipo: params.tipo,
    titulo: params.titulo.trim(),
    mensagem: params.mensagem?.trim() ? params.mensagem.trim() : null,
    valor: params.valor ?? null,
    anexo_url: params.anexoUrl ?? null,
    lida_por_profissional: false,
    lida_por_empresa: false,
    comprovante_detalhes: params.comprovanteDetalhes ?? {},
    metadata: params.metadata ?? params.comprovanteDetalhes ?? {},
  }

  const { data, error } = await supabase.from('canal_financeiro').insert(row).select('id').maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data?.id != null ? String(data.id) : undefined }
}
