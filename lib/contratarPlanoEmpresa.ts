import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanoCorId, ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'

export type ModalidadePlanoEmpresa = 'mensal' | 'trimestral' | 'anual'

export type PlanoEmpresaCatalogo = {
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

export function mapPlanoEmpresaRow(row: Record<string, unknown>): PlanoEmpresaCatalogo {
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

export async function listarPlanosAtivosEmpresa(
  supabase: SupabaseClient,
): Promise<PlanoEmpresaCatalogo[]> {
  const { data, error } = await supabase
    .from('planos')
    .select('id, nome, titulo, cor, descricao, servicos, preco_mensal, preco_trimestral, preco_anual, valor, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('preco_mensal', { ascending: true })

  if (error) throw error
  return (data ?? []).map((p) => mapPlanoEmpresaRow(p as Record<string, unknown>))
}

export function precoModalidadePlano(
  plano: PlanoEmpresaCatalogo,
  modalidade: ModalidadePlanoEmpresa,
): number {
  if (modalidade === 'trimestral') return plano.precoTrimestral
  if (modalidade === 'anual') return plano.precoAnual
  return plano.precoMensal
}

export function labelModalidadePlano(modalidade: ModalidadePlanoEmpresa): string {
  if (modalidade === 'trimestral') return 'Trimestral'
  if (modalidade === 'anual') return 'Anual'
  return 'Mensal'
}

/**
 * Contrata plano: atualiza `empresas.plano`.
 * Serviços liberados via `resolverServicosDoPlano` + `useEmpresaServicosPlano`.
 */
export async function contratarPlanoEmpresa(
  supabase: SupabaseClient,
  params: {
    empresaUsuarioId: string
    planoId: string
    modalidade: ModalidadePlanoEmpresa
  },
): Promise<{ ok: boolean; error?: string; planoTitulo?: string; empresaId?: string }> {
  const uid = params.empresaUsuarioId?.trim()
  const planoId = params.planoId?.trim()
  if (!uid || !planoId) return { ok: false, error: 'Dados inválidos.' }

  const modalidade = params.modalidade
  if (modalidade !== 'mensal' && modalidade !== 'trimestral' && modalidade !== 'anual') {
    return { ok: false, error: 'Modalidade inválida.' }
  }

  const { data: usuario } = await supabase.from('usuarios').select('status').eq('id', uid).maybeSingle()
  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('id, status, docs_verificado, aprovado_em, verificado_em, plano')
    .eq('usuario_id', uid)
    .maybeSingle()

  if (empErr || !emp?.id) return { ok: false, error: 'Empresa não encontrada.' }

  if (!empresaRecursosLiberados(usuario?.status != null ? String(usuario.status) : null, emp)) {
    return { ok: false, error: 'Cadastro ainda não liberado. Aguarde a verificação da documentação.' }
  }

  const { data: planoRow, error: planoErr } = await supabase
    .from('planos')
    .select('id, nome, titulo, ativo, servicos')
    .eq('id', planoId)
    .eq('ativo', true)
    .maybeSingle()

  if (planoErr || !planoRow) return { ok: false, error: 'Plano indisponível.' }

  const planoNome = String(planoRow.nome ?? '').trim()
  const planoTitulo = String(planoRow.titulo ?? planoNome)
  if (!planoNome) return { ok: false, error: 'Plano inválido.' }

  const empresaId = String(emp.id)

  const { error: upErr } = await supabase
    .from('empresas')
    .update({ plano: planoNome })
    .eq('id', empresaId)
    .eq('usuario_id', uid)

  if (upErr) return { ok: false, error: upErr.message }

  return { ok: true, planoTitulo, empresaId }
}
