import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type ModalidadePlanoEmpresa,
  precoModalidadePlano,
  mapPlanoEmpresaRow,
} from '@/lib/contratarPlanoEmpresa'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'
import type { FormaPagamentoPlano } from '@/lib/pagamentoPlanoEmpresa'
import { labelFormaPagamentoPlano } from '@/lib/pagamentoPlanoEmpresa'
import { registrarSolicitacaoAuxiliarAdmSeAplicavel } from '@/lib/empresaAuxiliarAdm'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { enviarMensagemPagamentoPlanoAdm, montarMensagemPagamentoPlano } from '@/lib/pagamentoPlanoEmpresa'

export type StatusAssinaturaEmpresa = 'pendente' | 'ativo' | 'inativo' | 'cancelado'

export type AssinaturaEmpresaRow = {
  id: string
  empresa_id: string
  plano_id: string | null
  plano_nome: string
  plano_titulo: string
  modalidade: ModalidadePlanoEmpresa
  forma_pagamento: FormaPagamentoPlano
  valor: number
  status: StatusAssinaturaEmpresa
  vencimento_em: string | null
  assinado_em: string
  validado_por: string | null
  validado_em: string | null
  visita_agendada_em: string | null
  visita_responsavel_nome: string | null
  visita_responsavel_whatsapp: string | null
  recusado_por: string | null
  recusado_em: string | null
  motivo_recusa: string | null
  created_at: string
}

export type DadosVisitaPagamentoDinheiro = {
  visitaAgendadaEm: string
  responsavelNome: string
  responsavelWhatsapp: string
}

function formatarDataVisita(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function montarTextoVisitaDinheiro(dados: DadosVisitaPagamentoDinheiro): string {
  return [
    `Visita agendada: ${formatarDataVisita(dados.visitaAgendadaEm)}`,
    `Responsável: ${dados.responsavelNome.trim()}`,
    `WhatsApp: ${dados.responsavelWhatsapp.trim()}`,
    'Na data faremos as fotos 360° e receberemos o pagamento em dinheiro.',
  ].join('\n')
}

export function calcularVencimentoAssinatura(
  modalidade: ModalidadePlanoEmpresa,
  base: Date = new Date(),
): Date {
  const d = new Date(base.getTime())
  if (modalidade === 'trimestral') {
    d.setMonth(d.getMonth() + 3)
    return d
  }
  if (modalidade === 'anual') {
    d.setFullYear(d.getFullYear() + 1)
    return d
  }
  d.setMonth(d.getMonth() + 1)
  return d
}

export function statusExibicaoAssinante(params: {
  status: StatusAssinaturaEmpresa
  vencimento_em: string | null
  agora?: Date
}): 'ATIVO' | 'INATIVO' {
  const agora = params.agora ?? new Date()
  if (params.status !== 'ativo') return 'INATIVO'
  if (!params.vencimento_em) return 'ATIVO'
  return new Date(params.vencimento_em).getTime() >= agora.getTime() ? 'ATIVO' : 'INATIVO'
}

export function diasParaVencimento(vencimentoIso: string | null, agora = new Date()): number | null {
  if (!vencimentoIso) return null
  const diff = new Date(vencimentoIso).getTime() - agora.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** Assinatura paga ativa e dentro do ciclo (vencimento_em). */
export function assinaturaContratadaVigente(
  row: { status?: string | null; vencimento_em?: string | null } | null | undefined,
  agora = new Date(),
): boolean {
  if (!row?.status || String(row.status) !== 'ativo') return false
  const venc = row.vencimento_em != null ? String(row.vencimento_em) : null
  if (!venc) return true
  return new Date(venc).getTime() >= agora.getTime()
}

/** Empresa deve ver lembrete de renovação (5 dias antes do vencimento). */
export function deveExibirLembreteVencimentoPlano(
  vencimentoIso: string | null | undefined,
  agora = new Date(),
): boolean {
  const dias = diasParaVencimento(vencimentoIso != null ? String(vencimentoIso) : null, agora)
  return dias != null && dias >= 0 && dias <= 5
}

export async function registrarAssinaturaPlanoEmpresa(
  supabase: SupabaseClient,
  params: {
    empresaUsuarioId: string
    planoId: string
    modalidade: ModalidadePlanoEmpresa
    formaPagamento: FormaPagamentoPlano
    visitaDinheiro?: DadosVisitaPagamentoDinheiro | null
  },
): Promise<{ ok: boolean; error?: string; assinaturaId?: string; planoTitulo?: string; planoContratado?: boolean }> {
  const uid = params.empresaUsuarioId?.trim()
  const planoId = params.planoId?.trim()
  const modalidade = params.modalidade
  const forma = params.formaPagamento

  if (!uid || !planoId) return { ok: false, error: 'Dados inválidos.' }
  if (modalidade !== 'mensal' && modalidade !== 'trimestral' && modalidade !== 'anual') {
    return { ok: false, error: 'Modalidade inválida.' }
  }
  if (forma !== 'cartao' && forma !== 'pix' && forma !== 'dinheiro') {
    return { ok: false, error: 'Forma de pagamento inválida.' }
  }

  if (forma === 'dinheiro') {
    const visita = params.visitaDinheiro
    if (!visita?.visitaAgendadaEm?.trim()) {
      return { ok: false, error: 'Informe a data da visita para pagamento em dinheiro.' }
    }
    if (!visita.responsavelNome?.trim()) {
      return { ok: false, error: 'Informe o nome do responsável pela visita.' }
    }
    if (!visita.responsavelWhatsapp?.trim()) {
      return { ok: false, error: 'Informe o WhatsApp do responsável.' }
    }
    const visitaDate = new Date(visita.visitaAgendadaEm)
    if (Number.isNaN(visitaDate.getTime())) {
      return { ok: false, error: 'Data da visita inválida.' }
    }
  }

  const { data: usuario } = await supabase.from('usuarios').select('status').eq('id', uid).maybeSingle()
  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('id, status, docs_verificado, aprovado_em, verificado_em, plano')
    .eq('usuario_id', uid)
    .maybeSingle()

  if (empErr || !emp?.id) return { ok: false, error: 'Empresa não encontrada.' }

  if (!empresaRecursosLiberados(usuario?.status != null ? String(usuario.status) : null, emp)) {
    return {
      ok: false,
      error: 'Cadastro ainda não liberado. Aguarde a verificação da documentação.',
    }
  }

  const { data: planoRow, error: planoErr } = await supabase
    .from('planos')
    .select('id, nome, titulo, ativo, preco_mensal, preco_trimestral, preco_anual, valor, servicos')
    .eq('id', planoId)
    .eq('ativo', true)
    .maybeSingle()

  if (planoErr || !planoRow) return { ok: false, error: 'Plano indisponível.' }

  const plano = mapPlanoEmpresaRow(planoRow as Record<string, unknown>)
  const planoNome = plano.nome.trim()
  const planoTitulo = plano.titulo.trim()
  if (!planoNome) return { ok: false, error: 'Plano inválido.' }

  const empresaId = String(emp.id)
  const valor = precoModalidadePlano(plano, modalidade)
  const agora = new Date()
  const agoraIso = agora.toISOString()
  const autoAtivo = forma === 'pix' || forma === 'cartao'
  const vencimento = autoAtivo ? calcularVencimentoAssinatura(modalidade, agora).toISOString() : null

  const visitaInsert =
    forma === 'dinheiro' && params.visitaDinheiro
      ? {
          visita_agendada_em: new Date(params.visitaDinheiro.visitaAgendadaEm).toISOString(),
          visita_responsavel_nome: params.visitaDinheiro.responsavelNome.trim(),
          visita_responsavel_whatsapp: params.visitaDinheiro.responsavelWhatsapp.trim(),
        }
      : {}

  const { data: ins, error: insErr } = await supabase
    .from('empresa_assinaturas')
    .insert({
      empresa_id: empresaId,
      plano_id: planoId,
      plano_nome: planoNome,
      plano_titulo: planoTitulo,
      modalidade,
      forma_pagamento: forma,
      valor,
      status: autoAtivo ? 'ativo' : 'pendente',
      vencimento_em: vencimento,
      assinado_em: agoraIso,
      updated_at: agoraIso,
      ...visitaInsert,
    })
    .select('id')
    .maybeSingle()

  if (insErr || !ins?.id) {
    return { ok: false, error: insErr?.message ?? 'Não foi possível registrar a assinatura.' }
  }

  if (autoAtivo) {
    const { error: upErr } = await supabase
      .from('empresas')
      .update({ plano: planoNome })
      .eq('id', empresaId)
      .eq('usuario_id', uid)

    if (upErr) return { ok: false, error: upErr.message }

    try {
      await supabase
        .from('empresa_degustacoes')
        .update({ status: 'cancelada', updated_at: agoraIso })
        .eq('empresa_id', empresaId)
        .eq('status', 'ativa')
    } catch {
      /* degustação opcional */
    }

    try {
      await registrarSolicitacaoAuxiliarAdmSeAplicavel(supabase, {
        empresaId,
        assinaturaId: String(ins.id),
        planoServicos: (planoRow as Record<string, unknown>).servicos,
      })
    } catch {
      /* solicitação auxiliar ADM opcional */
    }
  }

  if (forma === 'dinheiro' && params.visitaDinheiro) {
    const visitaTexto = montarTextoVisitaDinheiro(params.visitaDinheiro)
    const assinaturaId = String(ins.id)

    try {
      await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
        empresaUsuarioId: uid,
        tipo: 'pagamento_pendente',
        titulo: 'Solicitação de plano — pagamento em dinheiro',
        mensagem: `Solicitação registrada. ${visitaTexto.replace(/\n/g, ' · ')} Aguarde a confirmação do ADM Financeiro para liberar os serviços.`,
        valor,
        comprovanteDetalhes: {
          variant: 'assinatura_dinheiro_pendente',
          assinatura_id: assinaturaId,
          plano_titulo: planoTitulo,
          modalidade,
          visita: params.visitaDinheiro,
        },
      })
    } catch {
      /* notificação empresa opcional */
    }

    try {
      await enviarMensagemPagamentoPlanoAdm(
        supabase,
        empresaId,
        montarMensagemPagamentoPlano({
          planoTitulo,
          modalidade,
          preco: valor,
          forma: 'dinheiro',
          extra: `${visitaTexto} · Assinatura ID: ${assinaturaId} · Aguardando confirmação ADM.`,
        }),
      )
    } catch {
      /* chat ADM opcional */
    }
  }

  return {
    ok: true,
    assinaturaId: String(ins.id),
    planoTitulo,
    planoContratado: autoAtivo,
  }
}

export async function validarAssinaturaDinheiroEmpresa(
  supabase: SupabaseClient,
  params: { assinaturaId: string; adminUsuarioId: string },
): Promise<{ ok: boolean; error?: string }> {
  const assinaturaId = params.assinaturaId?.trim()
  const adminId = params.adminUsuarioId?.trim()
  if (!assinaturaId || !adminId) return { ok: false, error: 'Dados inválidos.' }

  const { data: row, error: fetchErr } = await supabase
    .from('empresa_assinaturas')
    .select('*')
    .eq('id', assinaturaId)
    .maybeSingle()

  if (fetchErr || !row) return { ok: false, error: 'Assinatura não encontrada.' }

  const status = String(row.status ?? '')
  const forma = String(row.forma_pagamento ?? '')
  if (status !== 'pendente' || forma !== 'dinheiro') {
    return { ok: false, error: 'Esta assinatura não está pendente de validação em dinheiro.' }
  }

  const modalidade = String(row.modalidade ?? 'mensal') as ModalidadePlanoEmpresa
  const agora = new Date()
  const agoraIso = agora.toISOString()
  const vencimento = calcularVencimentoAssinatura(modalidade, agora).toISOString()
  const empresaId = String(row.empresa_id)
  const planoNome = String(row.plano_nome ?? '').trim()

  const { error: upAssinatura } = await supabase
    .from('empresa_assinaturas')
    .update({
      status: 'ativo',
      vencimento_em: vencimento,
      validado_por: adminId,
      validado_em: agoraIso,
      updated_at: agoraIso,
    })
    .eq('id', assinaturaId)
    .eq('status', 'pendente')

  if (upAssinatura) return { ok: false, error: upAssinatura.message }

  if (planoNome) {
    const { error: upEmp } = await supabase.from('empresas').update({ plano: planoNome }).eq('id', empresaId)
    if (upEmp) return { ok: false, error: upEmp.message }
  }

  try {
    await supabase
      .from('empresa_degustacoes')
      .update({ status: 'cancelada', updated_at: agoraIso })
      .eq('empresa_id', empresaId)
      .eq('status', 'ativa')
  } catch {
    /* noop */
  }

  const planoId = row.plano_id != null ? String(row.plano_id) : null
  if (planoId) {
    const { data: planoRow } = await supabase
      .from('planos')
      .select('servicos')
      .eq('id', planoId)
      .maybeSingle()
    try {
      await registrarSolicitacaoAuxiliarAdmSeAplicavel(supabase, {
        empresaId,
        assinaturaId,
        planoServicos: planoRow?.servicos,
      })
    } catch {
      /* noop */
    }
  }

  try {
    const { data: emp } = await supabase
      .from('empresas')
      .select('usuario_id')
      .eq('id', empresaId)
      .maybeSingle()
    const empresaUsuarioId = emp?.usuario_id != null ? String(emp.usuario_id) : null
    if (empresaUsuarioId) {
      await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
        empresaUsuarioId,
        tipo: 'plano_assinatura',
        titulo: 'Plano confirmado e liberado',
        mensagem: `Pagamento em dinheiro confirmado. O plano ${String(row.plano_titulo ?? '')} está ativo até ${formatarDataVisita(vencimento)}.`,
        valor: Number(row.valor) || null,
        comprovanteDetalhes: {
          variant: 'assinatura_dinheiro_confirmada',
          assinatura_id: assinaturaId,
        },
      })
    }
  } catch {
    /* noop */
  }

  return { ok: true }
}

export async function recusarAssinaturaDinheiroEmpresa(
  supabase: SupabaseClient,
  params: { assinaturaId: string; adminUsuarioId: string; motivoRecusa?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const assinaturaId = params.assinaturaId?.trim()
  const adminId = params.adminUsuarioId?.trim()
  if (!assinaturaId || !adminId) return { ok: false, error: 'Dados inválidos.' }

  const { data: row, error: fetchErr } = await supabase
    .from('empresa_assinaturas')
    .select('*')
    .eq('id', assinaturaId)
    .maybeSingle()

  if (fetchErr || !row) return { ok: false, error: 'Assinatura não encontrada.' }

  const status = String(row.status ?? '')
  const forma = String(row.forma_pagamento ?? '')
  if (status !== 'pendente' || forma !== 'dinheiro') {
    return { ok: false, error: 'Esta assinatura não está pendente de validação em dinheiro.' }
  }

  const agoraIso = new Date().toISOString()
  const empresaId = String(row.empresa_id)
  const motivo = params.motivoRecusa?.trim() || null

  const { error: upAssinatura } = await supabase
    .from('empresa_assinaturas')
    .update({
      status: 'cancelado',
      recusado_por: adminId,
      recusado_em: agoraIso,
      motivo_recusa: motivo,
      updated_at: agoraIso,
    })
    .eq('id', assinaturaId)
    .eq('status', 'pendente')

  if (upAssinatura) return { ok: false, error: upAssinatura.message }

  try {
    const { data: emp } = await supabase
      .from('empresas')
      .select('usuario_id')
      .eq('id', empresaId)
      .maybeSingle()
    const empresaUsuarioId = emp?.usuario_id != null ? String(emp.usuario_id) : null
    if (empresaUsuarioId) {
      await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
        empresaUsuarioId,
        tipo: 'pagamento_pendente',
        titulo: 'Solicitação de plano recusada',
        mensagem: motivo
          ? `A solicitação de pagamento em dinheiro foi recusada. Motivo: ${motivo}`
          : 'A solicitação de pagamento em dinheiro foi recusada. Entre em contato pelo Mensageiro ou escolha outra forma de pagamento.',
        comprovanteDetalhes: {
          variant: 'assinatura_dinheiro_recusada',
          assinatura_id: assinaturaId,
          motivo_recusa: motivo,
        },
      })
    }
  } catch {
    /* noop */
  }

  return { ok: true }
}

export { labelFormaPagamentoPlano }
