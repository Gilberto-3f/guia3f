/**
 * Cobrança proporcional em upgrade/downgrade no meio do ciclo.
 * Ex.: 10 dias usados no plano atual + 20 dias restantes cobrados no plano novo.
 */
import type { ModalidadePlanoEmpresa } from '@/lib/contratarPlanoEmpresa'
import { diasParaVencimento } from '@/lib/empresaAssinatura'

export type AssinaturaAtualProporcional = {
  id: string
  plano_id: string | null
  plano_titulo: string
  modalidade: ModalidadePlanoEmpresa
  valor: number
  vencimento_em: string | null
}

export type ResultadoProporcional = {
  /** Sem assinatura vigente: cobrança cheia (nova ou renovação após vencimento). */
  tipo: 'nova' | 'renovacao_mesmo_plano' | 'upgrade' | 'downgrade' | 'troca'
  diasRestantes: number
  diasCicloAtual: number
  diasCicloNovo: number
  credito: number
  debitoProporcional: number
  valorCheioNovo: number
  /** Valor a cobrar agora (mínimo 0). */
  valorAPagar: number
  planoAnteriorTitulo: string | null
  /** Mantém o fim do ciclo atual quando há troca mid-cycle. */
  manterVencimentoEm: string | null
}

export function diasCicloModalidade(modalidade: ModalidadePlanoEmpresa): number {
  if (modalidade === 'trimestral') return 90
  if (modalidade === 'anual') return 365
  return 30
}

function arredondar2(n: number): number {
  return Math.round(Math.max(0, n) * 100) / 100
}

/**
 * Calcula crédito (dias não usados do plano atual) e débito (dias restantes no plano novo).
 */
export function calcularCobrancaProporcional(params: {
  assinaturaAtual: AssinaturaAtualProporcional | null
  planoNovoId: string
  planoNovoTitulo: string
  modalidadeNova: ModalidadePlanoEmpresa
  precoNovoCheio: number
  agora?: Date
}): ResultadoProporcional {
  const agora = params.agora ?? new Date()
  const valorCheioNovo = arredondar2(params.precoNovoCheio)
  const diasCicloNovo = diasCicloModalidade(params.modalidadeNova)
  const atual = params.assinaturaAtual

  if (!atual || !atual.vencimento_em || !assinaturaAindaNoCiclo(atual, agora)) {
    return {
      tipo: 'nova',
      diasRestantes: diasCicloNovo,
      diasCicloAtual: diasCicloNovo,
      diasCicloNovo,
      credito: 0,
      debitoProporcional: valorCheioNovo,
      valorCheioNovo,
      valorAPagar: valorCheioNovo,
      planoAnteriorTitulo: null,
      manterVencimentoEm: null,
    }
  }

  const diasRestantes = Math.max(0, diasParaVencimento(atual.vencimento_em, agora) ?? 0)
  const diasCicloAtual = diasCicloModalidade(atual.modalidade)
  const mesmoPlano =
    atual.plano_id != null &&
    String(atual.plano_id) === String(params.planoNovoId) &&
    atual.modalidade === params.modalidadeNova

  if (mesmoPlano) {
    // Renovação antecipada do mesmo plano: cobra ciclo cheio; serviços seguem ativos.
    return {
      tipo: 'renovacao_mesmo_plano',
      diasRestantes,
      diasCicloAtual,
      diasCicloNovo,
      credito: 0,
      debitoProporcional: valorCheioNovo,
      valorCheioNovo,
      valorAPagar: valorCheioNovo,
      planoAnteriorTitulo: atual.plano_titulo,
      manterVencimentoEm: null,
    }
  }

  const precoDiaAtual = diasCicloAtual > 0 ? Number(atual.valor) / diasCicloAtual : 0
  const precoDiaNovo = diasCicloNovo > 0 ? valorCheioNovo / diasCicloNovo : 0
  const credito = arredondar2(precoDiaAtual * diasRestantes)
  const debitoProporcional = arredondar2(precoDiaNovo * diasRestantes)
  const valorAPagar = arredondar2(debitoProporcional - credito)

  let tipo: ResultadoProporcional['tipo'] = 'troca'
  if (precoDiaNovo > precoDiaAtual + 0.0001) tipo = 'upgrade'
  else if (precoDiaNovo < precoDiaAtual - 0.0001) tipo = 'downgrade'

  return {
    tipo,
    diasRestantes,
    diasCicloAtual,
    diasCicloNovo,
    credito,
    debitoProporcional,
    valorCheioNovo,
    valorAPagar,
    planoAnteriorTitulo: atual.plano_titulo,
    manterVencimentoEm: atual.vencimento_em,
  }
}

function assinaturaAindaNoCiclo(
  atual: AssinaturaAtualProporcional,
  agora: Date,
): boolean {
  if (String(atual.modalidade ?? '') === '') return false
  const dias = diasParaVencimento(atual.vencimento_em, agora)
  return dias != null && dias > 0
}

export function textoExtratoProporcional(r: ResultadoProporcional, planoNovoTitulo: string): string {
  if (r.tipo === 'nova') {
    return `Assinatura do plano ${planoNovoTitulo} no valor de R$ ${r.valorAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
  }
  if (r.tipo === 'renovacao_mesmo_plano') {
    return `Renovação do plano ${planoNovoTitulo}: R$ ${r.valorAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (novo ciclo).`
  }
  const rotulo =
    r.tipo === 'upgrade' ? 'Upgrade' : r.tipo === 'downgrade' ? 'Downgrade' : 'Troca de plano'
  const anterior = r.planoAnteriorTitulo ?? 'plano anterior'
  return (
    `${rotulo}: ${anterior} → ${planoNovoTitulo}. ` +
    `${r.diasRestantes} dia(s) restantes — crédito R$ ${r.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, ` +
    `débito proporcional R$ ${r.debitoProporcional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ` +
    `Valor cobrado: R$ ${r.valorAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
  )
}
