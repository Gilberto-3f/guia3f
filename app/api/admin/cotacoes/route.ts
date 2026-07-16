import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  lerConfigCotacoes,
  sincronizarCotacoes,
  upsertCotacoes,
  type CotacaoModo,
  type CotacoesMap,
} from '@/lib/cotacoesSync'

function podeGerirCotacoes(adminRow: { admin_level?: number | null; admin_permissoes?: unknown } | null) {
  const nivel = Number(adminRow?.admin_level ?? 0)
  const cargo = (adminRow?.admin_permissoes as { cargo?: string } | null)?.cargo
  return nivel === 1 || cargo === 'FINANCEIRO'
}

async function requireAdminFinanceiro() {
  const auth = await assertAdminSession()
  if (!auth.ok) return { ok: false as const, error: auth.error }
  const { row } = await loadAdminUsuarioRow(auth.userId, auth.email)
  if (!podeGerirCotacoes(row)) {
    return { ok: false as const, error: jsonAdminError(403, 'forbidden', 'Sem permissão para cotações.') }
  }
  let adminDb
  try {
    adminDb = createSupabaseAdmin()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'service_role_unavailable'
    return { ok: false as const, error: jsonAdminError(503, 'admin_db', msg) }
  }
  return { ok: true as const, adminDb, actorId: row?.id ?? auth.userId }
}

/** Lista config + cotações atuais. */
export async function GET() {
  try {
    const gate = await requireAdminFinanceiro()
    if (!gate.ok) return gate.error

    const cfg = await lerConfigCotacoes(gate.adminDb)
    const { data: rows } = await gate.adminDb
      .from('cotacoes')
      .select('moeda, valor_brl, atualizado_em, fonte')
      .order('moeda')

    const { data: meta } = await gate.adminDb
      .from('config_apis')
      .select('cotacoes_sync_em')
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      ok: true,
      modo: cfg.modo,
      fonteUrl: cfg.fonteUrl,
      manual: cfg.manual,
      syncEm: meta?.cotacoes_sync_em ?? null,
      cotacoes: rows ?? [],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Salva modo/fonte/manual e opcionalmente aplica. */
export async function PATCH(req: Request) {
  try {
    const gate = await requireAdminFinanceiro()
    if (!gate.ok) return gate.error

    const body = (await req.json()) as Record<string, unknown>
    const modo: CotacaoModo = body.modo === 'manual' ? 'manual' : 'api'
    const fonteUrl =
      body.fonteUrl != null && String(body.fonteUrl).trim()
        ? String(body.fonteUrl).trim()
        : undefined
    const manualRaw = body.manual
    const manual: CotacoesMap = {}
    if (manualRaw && typeof manualRaw === 'object' && !Array.isArray(manualRaw)) {
      for (const [k, v] of Object.entries(manualRaw as Record<string, unknown>)) {
        const n = Number(v)
        if (k && Number.isFinite(n) && n > 0) manual[k.toUpperCase()] = n
      }
    }

    const { data: row } = await gate.adminDb.from('config_apis').select('id').limit(1).maybeSingle()
    if (!row?.id) {
      return NextResponse.json({ error: 'config_apis ausente' }, { status: 404 })
    }

    const payload: Record<string, unknown> = {
      cotacoes_modo: modo,
      atualizado_por: gate.actorId,
      atualizado_em: new Date().toISOString(),
    }
    if (fonteUrl !== undefined) payload.cotacoes_fonte_url = fonteUrl
    if (Object.keys(manual).length || body.manual != null) payload.cotacoes_manual = manual

    const { error } = await gate.adminDb.from('config_apis').update(payload).eq('id', row.id)
    if (error) throw error

    const aplicar = body.aplicar === true
    let sync = null
    if (aplicar) {
      if (modo === 'manual' && Object.keys(manual).length) {
        await upsertCotacoes(gate.adminDb, manual, 'manual')
        sync = { ok: true, modo: 'manual', map: manual }
      } else {
        sync = await sincronizarCotacoes(gate.adminDb)
      }
    }

    return NextResponse.json({ ok: true, modo, sync })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Dispara sync imediato conforme modo atual. */
export async function POST() {
  try {
    const gate = await requireAdminFinanceiro()
    if (!gate.ok) return gate.error

    const result = await sincronizarCotacoes(gate.adminDb)
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.erro ?? 'sync_failed', modo: result.modo },
        { status: 502 },
      )
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
