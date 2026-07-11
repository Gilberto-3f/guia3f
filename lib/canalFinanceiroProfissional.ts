import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'
import { itemCanalFinanceiroEhAvisoManifesto } from '@/lib/recomendacaoContratacaoDestino'

export type TipoNotificacaoFinanceiroProfissional =
  | 'mensagem_adm'
  | 'recibo_atendimento'
  | 'extrato_parceria'
  | 'extrato_comissao'
  | 'manifesto_indicacao'

export type InserirNotificacaoFinanceiroParams = {
  profissionalUsuarioId: string
  tipo: TipoNotificacaoFinanceiroProfissional
  titulo: string
  mensagem?: string | null
  valor?: number | null
  empresaId?: string | null
  anexoUrl?: string | null
  comprovanteDetalhes?: Record<string, unknown>
}

/**
 * Cria linha no canal financeiro privado do profissional (inbox de recibos, extratos, ADM).
 * Avisos de manifesto não são enviados a anfitriões (recurso de guia/van com placa vermelha).
 */
export async function inserirNotificacaoCanalFinanceiroProfissional(
  supabase: SupabaseClient,
  params: InserirNotificacaoFinanceiroParams
): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  const { data: prof, error: profErr } = await supabase
    .from('profissionais')
    .select('id, categorias')
    .eq('usuario_id', params.profissionalUsuarioId)
    .maybeSingle()

  if (profErr || !prof?.id) {
    return { ok: false, error: profErr?.message ?? 'Profissional não encontrado.' }
  }

  const cats = Array.isArray(prof.categorias)
    ? prof.categorias.filter((c): c is string => typeof c === 'string')
    : []
  if (
    categoriasIncluemAnfitriao(cats) &&
    itemCanalFinanceiroEhAvisoManifesto({
      tipo: params.tipo,
      titulo: params.titulo,
      mensagem: params.mensagem,
    })
  ) {
    return { ok: true, skipped: true }
  }

  const row: Record<string, unknown> = {
    profissional_id: prof.id,
    tipo: params.tipo,
    titulo: params.titulo.trim(),
    mensagem: params.mensagem?.trim() ? params.mensagem.trim() : null,
    valor: params.valor ?? null,
    anexo_url: params.anexoUrl ?? null,
    lida_por_profissional: false,
    lida_por_empresa: false,
    comprovante_detalhes: params.comprovanteDetalhes ?? {},
  }

  if (params.empresaId) {
    row.empresa_id = params.empresaId
  }

  const { data, error } = await supabase.from('canal_financeiro').insert(row).select('id').maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data?.id != null ? String(data.id) : undefined }
}
