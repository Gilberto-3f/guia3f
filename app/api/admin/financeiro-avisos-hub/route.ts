import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  adminPodeVerAvisosFinanceiroHub,
  filtrarAvisosFinanceiroHubPorAdmin,
  type FinanceiroAvisoAdmHubRow,
} from '@/lib/financeiroAvisosAdmHub'

function mapRow(r: Record<string, unknown>): FinanceiroAvisoAdmHubRow {
  return {
    id: String(r.id),
    tipo: String(r.tipo ?? ''),
    titulo: String(r.titulo ?? ''),
    mensagem: String(r.mensagem ?? ''),
    visivel_para: Array.isArray(r.visivel_para) ? r.visivel_para.map(String) : [],
    metadata: r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : {},
    lido_por: Array.isArray(r.lido_por) ? r.lido_por.map(String) : [],
    created_at: String(r.created_at ?? ''),
  }
}

/** Lista cards informativos do hub Canal Financeiro ADM (ADM GERAL + ADM Financeiro). */
export async function GET() {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error

    const { row: adminRow } = await loadAdminUsuarioRow(auth.userId, auth.email)
    if (!adminRow || !adminPodeVerAvisosFinanceiroHub(adminRow)) {
      return jsonAdminError(403, 'forbidden', 'Acesso restrito ao ADM GERAL ou ADM Financeiro.')
    }

    const adminDb = createSupabaseAdmin()
    const { data, error } = await adminDb
      .from('financeiro_avisos_adm_hub')
      .select('id, tipo, titulo, mensagem, visivel_para, metadata, lido_por, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return jsonAdminError(500, 'db', error.message)
    }

    const rows = (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
    const filtrados = filtrarAvisosFinanceiroHubPorAdmin(rows, adminRow)

    return NextResponse.json({
      ok: true,
      avisos: filtrados.map((a) => ({
        ...a,
        lido: a.lido_por.includes(adminRow.id),
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Marca aviso como lido pelo admin autenticado. */
export async function PATCH(req: Request) {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error

    const { row: adminRow } = await loadAdminUsuarioRow(auth.userId, auth.email)
    if (!adminRow || !adminPodeVerAvisosFinanceiroHub(adminRow)) {
      return jsonAdminError(403, 'forbidden', 'Acesso restrito ao ADM GERAL ou ADM Financeiro.')
    }

    const body = (await req.json()) as { id?: string }
    const id = String(body.id ?? '').trim()
    if (!id) {
      return jsonAdminError(400, 'validation', 'id é obrigatório.')
    }

    const adminDb = createSupabaseAdmin()
    const { data: atual, error: fetchErr } = await adminDb
      .from('financeiro_avisos_adm_hub')
      .select('id, visivel_para, lido_por')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !atual?.id) {
      return jsonAdminError(404, 'not_found', 'Aviso não encontrado.')
    }

    const row = mapRow(atual as Record<string, unknown>)
    if (!filtrarAvisosFinanceiroHubPorAdmin([row], adminRow).length) {
      return jsonAdminError(403, 'forbidden', 'Sem permissão para este aviso.')
    }

    const lidoPor = Array.isArray(atual.lido_por) ? atual.lido_por.map(String) : []
    if (lidoPor.includes(adminRow.id)) {
      return NextResponse.json({ ok: true })
    }

    const { error: upErr } = await adminDb
      .from('financeiro_avisos_adm_hub')
      .update({ lido_por: [...lidoPor, adminRow.id] })
      .eq('id', id)

    if (upErr) {
      return jsonAdminError(500, 'db', upErr.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
