import { supabase } from '@/lib/supabase'

/**
 * Link do app parceiro (loja/deep link) para o botão APP PARCEIRO.
 * Preferência: `app_parceiro_link`; fallback: `api_mobilidade_url` se ainda não cadastrado.
 */
export async function carregarLinkAppParceiro(): Promise<string | null> {
  const { data } = await supabase
    .from('config_apis')
    .select('app_parceiro_link, api_mobilidade_url')
    .limit(1)
    .maybeSingle()

  const preferido =
    data?.app_parceiro_link != null ? String(data.app_parceiro_link).trim() : ''
  if (preferido) return preferido

  const fallback =
    data?.api_mobilidade_url != null ? String(data.api_mobilidade_url).trim() : ''
  return fallback || null
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
