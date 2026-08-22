import {
  normalizarCidadeTriplice,
  type CidadeTriplice,
} from '@/lib/mobilidadeRegional'

/** Canal de app/API parceiro de mobilidade urbana (independentes por cidade). */
export type CanalParceiroMobilidade = 'foz' | 'cde'

export type ConfigApisMobilidadeParceiro = {
  api_mobilidade_url?: string | null
  api_mobilidade_key?: string | null
  app_parceiro_link?: string | null
  api_mobilidade_url_foz?: string | null
  api_mobilidade_key_foz?: string | null
  app_parceiro_link_foz?: string | null
  api_mobilidade_url_cde?: string | null
  api_mobilidade_key_cde?: string | null
  app_parceiro_link_cde?: string | null
}

/** Colunas públicas de redirect/loja. Nunca incluir `api_mobilidade_key*` (só ADM / service role). */
export const CONFIG_APIS_MOBILIDADE_SELECT =
  'api_mobilidade_url, app_parceiro_link, api_mobilidade_url_foz, app_parceiro_link_foz, api_mobilidade_url_cde, app_parceiro_link_cde'

function trimOrNull(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim()
  return s || null
}

function pickPreferido(
  preferido: string | null | undefined,
  ...fallbacks: Array<string | null | undefined>
): string | null {
  const first = trimOrNull(preferido)
  if (first) return first
  for (const f of fallbacks) {
    const t = trimOrNull(f)
    if (t) return t
  }
  return null
}

/** Mapeia cidade da Tríplice → canal Foz ou CDE (Puerto não tem canal próprio). */
export function canalParceiroPorCidade(
  cidade: CidadeTriplice | string | null | undefined,
): CanalParceiroMobilidade | null {
  const c =
    typeof cidade === 'string' &&
    cidade !== 'Foz do Iguaçu' &&
    cidade !== 'Ciudad del Este' &&
    cidade !== 'Puerto Iguazu'
      ? normalizarCidadeTriplice(cidade)
      : (cidade as CidadeTriplice | null | undefined)
  if (c === 'Foz do Iguaçu') return 'foz'
  if (c === 'Ciudad del Este') return 'cde'
  return null
}

/**
 * Canal do deslocamento urbano:
 * - origem = destino (Foz ou CDE) → canal dessa cidade
 * - só origem conhecida → canal da origem
 * - cruzamento / Puerto → null (não usa API urbana de uma cidade)
 */
export function canalParceiroPorTrecho(
  origem: CidadeTriplice | null | undefined,
  destino?: CidadeTriplice | null | undefined,
): CanalParceiroMobilidade | null {
  if (origem && destino) {
    if (origem === destino) return canalParceiroPorCidade(origem)
    return null
  }
  return canalParceiroPorCidade(origem ?? destino ?? null)
}

/** URL de redirect para contratantes (turista/empresa) do motorista de app. */
export function resolverUrlApiMobilidadeParceiro(
  cfg: ConfigApisMobilidadeParceiro | null | undefined,
  canal: CanalParceiroMobilidade | null,
): string | null {
  if (!cfg) return null
  if (canal === 'foz') {
    return pickPreferido(cfg.api_mobilidade_url_foz, cfg.api_mobilidade_url)
  }
  if (canal === 'cde') {
    return pickPreferido(cfg.api_mobilidade_url_cde, cfg.api_mobilidade_url)
  }
  return pickPreferido(cfg.api_mobilidade_url)
}

/** Link loja/deep link do botão APP PARCEIRO (profissionais). */
export function resolverLinkAppParceiro(
  cfg: ConfigApisMobilidadeParceiro | null | undefined,
  canal: CanalParceiroMobilidade | null,
): string | null {
  if (!cfg) return null
  if (canal === 'foz') {
    return pickPreferido(
      cfg.app_parceiro_link_foz,
      cfg.app_parceiro_link,
      cfg.api_mobilidade_url_foz,
      cfg.api_mobilidade_url,
    )
  }
  if (canal === 'cde') {
    return pickPreferido(
      cfg.app_parceiro_link_cde,
      cfg.app_parceiro_link,
      cfg.api_mobilidade_url_cde,
      cfg.api_mobilidade_url,
    )
  }
  return pickPreferido(cfg.app_parceiro_link, cfg.api_mobilidade_url)
}

/** Canal a partir da lista de cidades de atuação do profissional. */
export function canalParceiroPorCidadesAtuacao(
  cidades: unknown,
): CanalParceiroMobilidade | null {
  const lista = Array.isArray(cidades)
    ? cidades.map(String)
    : cidades != null
      ? [String(cidades)]
      : []
  for (const raw of lista) {
    const canal = canalParceiroPorCidade(normalizarCidadeTriplice(raw) ?? raw)
    if (canal) return canal
  }
  return null
}
