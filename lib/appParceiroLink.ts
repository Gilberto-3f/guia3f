import { supabase } from '@/lib/supabase'
import {
  canalParceiroPorCidade,
  canalParceiroPorCidadesAtuacao,
  CONFIG_APIS_MOBILIDADE_SELECT,
  resolverLinkAppParceiro,
  type CanalParceiroMobilidade,
} from '@/lib/mobilidadeParceiroApi'
import type { CidadeTriplice } from '@/lib/mobilidadeRegional'

export type CarregarLinkAppParceiroOpts = {
  /** Cidade explícita (Foz / CDE). */
  cidade?: CidadeTriplice | string | null
  /** Lista cidade_atuacao do profissional. */
  cidadesAtuacao?: unknown
  /** Canal já resolvido. */
  canal?: CanalParceiroMobilidade | null
}

/**
 * Link do app parceiro (loja/deep link) para o botão APP PARCEIRO.
 * Escolhe canal Foz ou CDE quando a cidade/atuação for informada.
 */
export async function carregarLinkAppParceiro(
  opts?: CarregarLinkAppParceiroOpts,
): Promise<string | null> {
  const canal =
    opts?.canal ??
    (opts?.cidade != null ? canalParceiroPorCidade(opts.cidade) : null) ??
    canalParceiroPorCidadesAtuacao(opts?.cidadesAtuacao)

  const { data } = await supabase
    .from('config_apis')
    .select(CONFIG_APIS_MOBILIDADE_SELECT)
    .limit(1)
    .maybeSingle()

  return resolverLinkAppParceiro(data, canal)
}

/** Abre o link em nova aba; retorna false se URL inválida/ausente. */
export function abrirLinkAppParceiro(url: string | null | undefined): boolean {
  const u = String(url ?? '').trim()
  if (!u) return false
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    window.open(parsed.toString(), '_blank', 'noopener,noreferrer')
    return true
  } catch {
    return false
  }
}
