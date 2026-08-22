import {
  canalParceiroPorCidade,
  canalParceiroPorCidadesAtuacao,
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

export type ConfigParceiroMobilidadePublica = {
  url: string | null
  app_parceiro_link: string | null
}

function resolverCanal(opts?: CarregarLinkAppParceiroOpts): CanalParceiroMobilidade | null {
  return (
    opts?.canal ??
    (opts?.cidade != null ? canalParceiroPorCidade(opts.cidade) : null) ??
    canalParceiroPorCidadesAtuacao(opts?.cidadesAtuacao)
  )
}

/**
 * URL/link públicos do parceiro (sem API key). Lê via rota server.
 */
export async function carregarConfigParceiroMobilidade(
  opts?: CarregarLinkAppParceiroOpts,
): Promise<ConfigParceiroMobilidadePublica> {
  const canal = resolverCanal(opts)
  const q = new URLSearchParams()
  if (canal) q.set('canal', canal)
  try {
    const res = await fetch(`/api/mobilidade/parceiro-config?${q.toString()}`, {
      credentials: 'include',
    })
    if (!res.ok) return { url: null, app_parceiro_link: null }
    const json = (await res.json()) as {
      url?: string | null
      app_parceiro_link?: string | null
    }
    const url = String(json.url ?? '').trim() || null
    const app_parceiro_link = String(json.app_parceiro_link ?? '').trim() || null
    return { url, app_parceiro_link }
  } catch {
    return { url: null, app_parceiro_link: null }
  }
}

/**
 * Link do app parceiro (loja/deep link) para o botão APP PARCEIRO.
 * Escolhe canal Foz ou CDE quando a cidade/atuação for informada.
 */
export async function carregarLinkAppParceiro(
  opts?: CarregarLinkAppParceiroOpts,
): Promise<string | null> {
  const cfg = await carregarConfigParceiroMobilidade(opts)
  return cfg.app_parceiro_link || cfg.url
}

/** URL de redirect do motorista de app (contratante). */
export async function carregarUrlApiMobilidadeParceiro(
  opts?: CarregarLinkAppParceiroOpts,
): Promise<string | null> {
  const cfg = await carregarConfigParceiroMobilidade(opts)
  return cfg.url
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
