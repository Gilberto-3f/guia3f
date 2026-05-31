import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlvoTipoFinanceiro } from '@/lib/financeiroConversas'

export type DesempenhoProfissionalFinanceiro = {
  recomendacoesTotal: number
  topEmpresasIndicadas: Array<{ empresaId: string; nome: string; categoria: string; total: number }>
  comissoesGanhasQtd: number
  comissoesGanhasValor: number
  parceriasFechadas: number
  atendimentosConcluidos: number
}

export type DesempenhoEmpresaFinanceiro = {
  comissoesPagasQtd: number
  comissoesPagasValor: number
  receptivoPaxQtd: number
}

export async function carregarDesempenhoFinanceiro(
  supabase: SupabaseClient,
  tipo: AlvoTipoFinanceiro,
  alvoUsuarioId: string,
): Promise<DesempenhoProfissionalFinanceiro | DesempenhoEmpresaFinanceiro | null> {
  if (tipo === 'profissional') {
    return carregarDesempenhoProfissional(supabase, alvoUsuarioId)
  }
  return carregarDesempenhoEmpresa(supabase, alvoUsuarioId)
}

async function carregarDesempenhoProfissional(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<DesempenhoProfissionalFinanceiro | null> {
  const { data: prof } = await supabase.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
  if (!prof?.id) return null
  const profissionalId = String(prof.id)

  const [{ count: recCount }, { data: recRows }, cfRes, { count: atendCount }] = await Promise.all([
    supabase
      .from('recomendacoes')
      .select('id', { count: 'exact', head: true })
      .eq('profissional_id', profissionalId),
    supabase
      .from('recomendacoes')
      .select('empresa_id, empresas ( id, nome_fantasia, categoria )')
      .eq('profissional_id', profissionalId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('canal_financeiro')
      .select('tipo, valor')
      .eq('profissional_id', profissionalId)
      .in('tipo', ['extrato_comissao', 'extrato_parceria']),
    supabase
      .from('logs_atendimentos')
      .select('id', { count: 'exact', head: true })
      .eq('profissional_id', profissionalId),
  ])

  const porEmpresa = new Map<string, { empresaId: string; nome: string; categoria: string; total: number }>()
  for (const r of recRows ?? []) {
    const empRaw = r.empresas as { id?: string; nome_fantasia?: string; categoria?: string } | { id?: string; nome_fantasia?: string; categoria?: string }[] | null
    const emp = Array.isArray(empRaw) ? empRaw[0] : empRaw
    const eid = emp?.id != null ? String(emp.id) : String(r.empresa_id ?? '')
    if (!eid) continue
    const prev = porEmpresa.get(eid)
    const nome = String(emp?.nome_fantasia ?? 'Empresa')
    const categoria = String(emp?.categoria ?? '')
    porEmpresa.set(eid, {
      empresaId: eid,
      nome,
      categoria,
      total: (prev?.total ?? 0) + 1,
    })
  }

  const topEmpresasIndicadas = [...porEmpresa.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  let comissoesGanhasQtd = 0
  let comissoesGanhasValor = 0
  let parceriasFechadas = 0
  for (const row of cfRes.data ?? []) {
    const t = String(row.tipo ?? '')
    if (t === 'extrato_comissao') {
      comissoesGanhasQtd++
      const v = row.valor != null ? Number(row.valor) : 0
      if (Number.isFinite(v)) comissoesGanhasValor += v
    } else if (t === 'extrato_parceria') {
      parceriasFechadas++
    }
  }

  return {
    recomendacoesTotal: recCount ?? 0,
    topEmpresasIndicadas,
    comissoesGanhasQtd,
    comissoesGanhasValor,
    parceriasFechadas,
    atendimentosConcluidos: atendCount ?? 0,
  }
}

async function carregarDesempenhoEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<DesempenhoEmpresaFinanceiro | null> {
  const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
  if (!emp?.id) return null
  const empresaId = String(emp.id)

  const { data: cfRows } = await supabase
    .from('canal_financeiro')
    .select('tipo, valor')
    .eq('empresa_id', empresaId)
    .in('tipo', ['extrato_comissao_paga', 'comprovante_pagamento', 'relatorio_pax'])

  let comissoesPagasQtd = 0
  let comissoesPagasValor = 0
  let receptivoPaxQtd = 0

  for (const row of cfRows ?? []) {
    const t = String(row.tipo ?? '')
    if (t === 'extrato_comissao_paga' || t === 'comprovante_pagamento') {
      comissoesPagasQtd++
      const v = row.valor != null ? Number(row.valor) : 0
      if (Number.isFinite(v)) comissoesPagasValor += v
    } else if (t === 'relatorio_pax') {
      receptivoPaxQtd++
    }
  }

  return {
    comissoesPagasQtd,
    comissoesPagasValor,
    receptivoPaxQtd,
  }
}
