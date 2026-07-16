import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizarTextoTaxonomia } from '@/lib/comprasCdeCatalogo'

function parseCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * Materializa intenções do mês anterior em drena_intencao_mensal.
 * Rodar no dia 1 de cada mês (ou sob demanda com ?ano=&mes=).
 */
export async function GET(request: Request) {
  if (!parseCronAuth(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const agora = new Date()
  let ano = Number(url.searchParams.get('ano'))
  let mes = Number(url.searchParams.get('mes'))
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    // Mês anterior
    const prev = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1))
    ano = prev.getUTCFullYear()
    mes = prev.getUTCMonth() + 1
  }

  try {
    const admin = createSupabaseAdmin()
    const inicio = new Date(Date.UTC(ano, mes - 1, 1)).toISOString()
    const fim = new Date(Date.UTC(ano, mes, 1)).toISOString()

    const { data: buscas, error } = await admin
      .from('buscas_produto')
      .select('termo_busca, tipo, produto_id')
      .gte('created_at', inicio)
      .lt('created_at', fim)
      .limit(20000)

    if (error) throw error

    const agg = new Map<string, { termo: string; tipo: string; total: number }>()

    for (const b of buscas ?? []) {
      const termo = String(b.termo_busca ?? '').trim()
      if (!termo) continue
      const tipo = String(b.tipo ?? 'busca')
      const norm = normalizarTextoTaxonomia(termo)
      if (!norm) continue
      const key = `${tipo}::${norm}`
      const cur = agg.get(key)
      if (cur) cur.total += 1
      else agg.set(key, { termo, tipo, total: 1 })
    }

    let upserts = 0
    for (const row of agg.values()) {
      const { error: uErr } = await admin.from('drena_intencao_mensal').upsert(
        {
          ano,
          mes,
          termo: row.termo.slice(0, 200),
          termo_normalizado: normalizarTextoTaxonomia(row.termo),
          tipo: row.tipo,
          total_buscas: row.total,
        },
        { onConflict: 'ano,mes,termo_normalizado,tipo' },
      )
      if (!uErr) upserts += 1
    }

    return NextResponse.json({
      ok: true,
      ano,
      mes,
      termos: agg.size,
      upserts,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error('[api/cron/drena-snapshot]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
