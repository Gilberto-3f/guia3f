import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModalidadePlanoEmpresa } from '@/lib/contratarPlanoEmpresa'
import { labelModalidadePlano } from '@/lib/contratarPlanoEmpresa'

export type FormaPagamentoPlano = 'cartao' | 'pix' | 'dinheiro'

export function labelFormaPagamentoPlano(forma: FormaPagamentoPlano): string {
  if (forma === 'pix') return 'PIX'
  if (forma === 'dinheiro') return 'Dinheiro'
  return 'Cartão'
}

export async function fetchPixCopiaColaPlano(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.from('config_geral').select('pix_copia_cola').limit(1).maybeSingle()
  if (error || !data?.pix_copia_cola) return ''
  return String(data.pix_copia_cola).trim()
}

export function formatarNumeroCartao(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

export function formatarValidadeCartao(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function cartaoPlanoValido(params: {
  nome: string
  numero: string
  validade: string
  cvv: string
}): string | null {
  if (!params.nome.trim()) return 'Informe o nome impresso no cartão.'
  const num = params.numero.replace(/\D/g, '')
  if (num.length < 13) return 'Número do cartão inválido.'
  const val = params.validade.replace(/\D/g, '')
  if (val.length !== 4) return 'Validade inválida (MM/AA).'
  const mes = Number(val.slice(0, 2))
  if (mes < 1 || mes > 12) return 'Mês de validade inválido.'
  const cvv = params.cvv.replace(/\D/g, '')
  if (cvv.length < 3 || cvv.length > 4) return 'CVV inválido.'
  return null
}

export function montarMensagemPagamentoPlano(params: {
  planoTitulo: string
  modalidade: ModalidadePlanoEmpresa
  preco: number
  forma: FormaPagamentoPlano
  extra?: string
}): string {
  const mod = labelModalidadePlano(params.modalidade)
  const forma = labelFormaPagamentoPlano(params.forma)
  const valor = params.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const base = `[PLANO] ${params.planoTitulo} (${mod}) — R$ ${valor} — pagamento: ${forma}`
  return params.extra?.trim() ? `${base}. ${params.extra.trim()}` : base
}

export async function enviarMensagemPagamentoPlanoAdm(
  supabase: SupabaseClient,
  empresaId: string,
  mensagem: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('mensagens_chat_adm').insert({
    empresa_id: empresaId,
    mensagem: mensagem.trim(),
    lida_admin: false,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
