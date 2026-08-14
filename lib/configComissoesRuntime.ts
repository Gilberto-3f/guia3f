import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConfiguracoesComissoes } from '@/app/[locale]/(admin)/dashboard/admin/hooks/useFinanceiroAdm'

const DEFAULT_CONFIG: ConfiguracoesComissoes = {
  empresa_split: { regular: 50, indicador: 50 },
  servico_particular: {
    taxa: 20,
    modelo_com_indicacao: { regular: 50, indicador: 30, empresa_parceira: 10, plataforma: 10 },
    modelo_sem_indicacao: { regular: 70, empresa_parceira: 10, plataforma: 20 },
  },
  tickets_reservas: {
    profissional_indicador: 70,
    parceiro_indicador: 20,
    empresa_parceira: 5,
    plataforma: 5,
  },
  mobilidade_tabelada: {
    taxa: 100,
    regular: 70,
    indicador: 30,
    plataforma: 0,
  },
  mobilidade_urbana: { taxa: 0 },
}

/** Lê config ativa de comissões (fallback para defaults ADM). */
export async function buscarConfigComissoesAtiva(
  supabase: SupabaseClient,
): Promise<ConfiguracoesComissoes> {
  const { data } = await supabase
    .from('config_comissoes')
    .select('dados')
    .eq('ativo', true)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data?.dados && typeof data.dados === 'object') {
    return { ...DEFAULT_CONFIG, ...(data.dados as ConfiguracoesComissoes) }
  }
  return DEFAULT_CONFIG
}

export function parProfissionaisOrdenado(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1]
}
