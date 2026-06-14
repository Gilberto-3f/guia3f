import type { SupabaseClient } from '@supabase/supabase-js'
import { corPlanoHex, labelServicoPlano, type PlanoCorId, type ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'

export const TITULO_PLANOS_CANAL = 'Planos disponíveis'

export const MENSAGEM_PLANOS_CANAL =
  'Confira os planos disponíveis da nossa plataforma e escolha o que atende melhor suas necessidades.'

export type PlanoCanalFinanceiroPayload = {
  id: string
  nome: string
  titulo: string
  cor: PlanoCorId
  descricao: string
  servicos: ServicoPlanoId[]
  precoMensal: number
  precoTrimestral: number
  precoAnual: number
}

function mapPlanoCanal(row: Record<string, unknown>): PlanoCanalFinanceiroPayload {
  const servicosRaw = row.servicos
  const servicos = Array.isArray(servicosRaw)
    ? servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
    : []

  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    titulo: String(row.titulo ?? row.nome ?? 'Plano'),
    cor: (String(row.cor ?? 'azul') as PlanoCorId) || 'azul',
    descricao: String(row.descricao ?? ''),
    servicos,
    precoMensal: Number(row.preco_mensal ?? row.valor ?? 0),
    precoTrimestral: Number(row.preco_trimestral ?? 0),
    precoAnual: Number(row.preco_anual ?? 0),
  }
}

/**
 * Envia catálogo de planos ao canal financeiro privado da empresa (aba Relatórios),
 * após liberação do cadastro. Idempotente por empresa.
 */
export async function enviarPlanosDisponiveisCanalFinanceiroEmpresa(
  supabase: SupabaseClient,
  empresaUsuarioId: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const uid = empresaUsuarioId?.trim()
  if (!uid) return { ok: false, error: 'usuario_vazio' }

  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('id')
    .eq('usuario_id', uid)
    .maybeSingle()

  if (empErr || !emp?.id) {
    return { ok: false, error: empErr?.message ?? 'empresa_nao_encontrada' }
  }

  const { count } = await supabase
    .from('canal_financeiro')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', emp.id)
    .eq('tipo', 'plano_assinatura')
    .eq('titulo', TITULO_PLANOS_CANAL)

  if (count && count > 0) return { ok: true, skipped: true }

  const { data: planosRows, error: planosErr } = await supabase
    .from('planos')
    .select('id, nome, titulo, cor, descricao, servicos, preco_mensal, preco_trimestral, preco_anual, valor, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('preco_mensal', { ascending: true })

  if (planosErr) return { ok: false, error: planosErr.message }

  const planos = (planosRows ?? []).map((p) => mapPlanoCanal(p as Record<string, unknown>))
  if (planos.length === 0) return { ok: true, skipped: true }

  const res = await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
    empresaUsuarioId: uid,
    tipo: 'plano_assinatura',
    titulo: TITULO_PLANOS_CANAL,
    mensagem: MENSAGEM_PLANOS_CANAL,
    comprovanteDetalhes: {
      variant: 'catalogo_planos',
      planos: planos.map((p) => ({
        ...p,
        corHex: corPlanoHex(p.cor),
        servicosLabels: p.servicos.map((s) => labelServicoPlano(s)),
      })),
    },
  })

  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true }
}
