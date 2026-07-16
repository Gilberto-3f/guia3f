import type { SupabaseClient } from '@supabase/supabase-js'

export type CotacaoModo = 'api' | 'manual'

/** Qtd da moeda estrangeira por 1 BRL (mesmo contrato da tabela cotacoes). */
export type CotacoesMap = Record<string, number>

const AWESOME_DEFAULT =
  'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,ARS-BRL,PYG-BRL'

/** Converte bid AwesomeAPI (BRL por 1 unidade estrangeira) → unidades estrangeiras por 1 BRL. */
export function bidParaTaxaInterna(bid: number): number {
  if (!Number.isFinite(bid) || bid <= 0) return 0
  return Math.round((1 / bid) * 1_000_000) / 1_000_000
}

export async function fetchCotacoesAwesomeApi(url?: string | null): Promise<CotacoesMap> {
  const endpoint = (url && url.trim()) || AWESOME_DEFAULT
  const res = await fetch(endpoint, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`AwesomeAPI HTTP ${res.status}`)
  const json = (await res.json()) as Record<string, { bid?: string; code?: string }>
  const out: CotacoesMap = {}

  const pairs: { key: string; moeda: string }[] = [
    { key: 'USDBRL', moeda: 'USD' },
    { key: 'EURBRL', moeda: 'EUR' },
    { key: 'ARSBRL', moeda: 'ARS' },
    { key: 'PYGBRL', moeda: 'PYG' },
  ]

  for (const { key, moeda } of pairs) {
    const row = json[key]
    const bid = row?.bid != null ? Number(row.bid) : NaN
    const taxa = bidParaTaxaInterna(bid)
    if (taxa > 0) out[moeda] = taxa
  }

  if (!Object.keys(out).length) throw new Error('AwesomeAPI sem cotações válidas')
  return out
}

export async function lerConfigCotacoes(admin: SupabaseClient): Promise<{
  modo: CotacaoModo
  fonteUrl: string
  manual: CotacoesMap
}> {
  const { data } = await admin
    .from('config_apis')
    .select('cotacoes_modo, cotacoes_fonte_url, cotacoes_manual')
    .limit(1)
    .maybeSingle()

  const modo = data?.cotacoes_modo === 'manual' ? 'manual' : 'api'
  const fonteUrl =
    data?.cotacoes_fonte_url != null && String(data.cotacoes_fonte_url).trim()
      ? String(data.cotacoes_fonte_url)
      : AWESOME_DEFAULT
  const manualRaw = data?.cotacoes_manual
  const manual: CotacoesMap = {}
  if (manualRaw && typeof manualRaw === 'object' && !Array.isArray(manualRaw)) {
    for (const [k, v] of Object.entries(manualRaw as Record<string, unknown>)) {
      const n = Number(v)
      if (k && Number.isFinite(n) && n > 0) manual[k.toUpperCase()] = n
    }
  }
  return { modo, fonteUrl, manual }
}

export async function upsertCotacoes(
  admin: SupabaseClient,
  map: CotacoesMap,
  fonte: string,
): Promise<number> {
  let n = 0
  const agora = new Date().toISOString()
  for (const [moeda, valor_brl] of Object.entries(map)) {
    const { error } = await admin.from('cotacoes').upsert(
      {
        moeda,
        valor_brl,
        atualizado_em: agora,
        fonte,
      },
      { onConflict: 'moeda' },
    )
    if (!error) n += 1
    else console.error('[cotacoesSync] upsert', moeda, error.message)
  }
  const { data: cfgRow } = await admin.from('config_apis').select('id').limit(1).maybeSingle()
  if (cfgRow?.id) {
    await admin.from('config_apis').update({ cotacoes_sync_em: agora }).eq('id', cfgRow.id)
  }
  return n
}

/** Sincroniza conforme modo api/manual em config_apis. */
export async function sincronizarCotacoes(admin: SupabaseClient): Promise<{
  ok: boolean
  modo: CotacaoModo
  atualizadas: number
  map: CotacoesMap
  erro?: string
}> {
  try {
    const cfg = await lerConfigCotacoes(admin)
    if (cfg.modo === 'manual') {
      if (!Object.keys(cfg.manual).length) {
        return { ok: false, modo: 'manual', atualizadas: 0, map: {}, erro: 'manual_vazio' }
      }
      const atualizadas = await upsertCotacoes(admin, cfg.manual, 'manual')
      return { ok: true, modo: 'manual', atualizadas, map: cfg.manual }
    }
    const map = await fetchCotacoesAwesomeApi(cfg.fonteUrl)
    const atualizadas = await upsertCotacoes(admin, map, 'awesomeapi')
    return { ok: true, modo: 'api', atualizadas, map }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return { ok: false, modo: 'api', atualizadas: 0, map: {}, erro: msg }
  }
}
