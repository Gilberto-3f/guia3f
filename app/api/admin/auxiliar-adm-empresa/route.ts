import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

function isAdminGeral(adminRow: { admin_level?: number | null } | null) {
  return Number(adminRow?.admin_level ?? 0) === 1
}

type EmpresaJoin = {
  id: string
  nome_fantasia: string | null
  nome_usuario: string | null
  foto_url: string | null
  usuario_id: string | null
}

/** Lista solicitações pendentes de Auxiliar ADM (ADM Geral). */
export async function GET() {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error

    const { row: adminRow } = await loadAdminUsuarioRow(auth.userId, auth.email)
    if (!isAdminGeral(adminRow)) {
      return jsonAdminError(403, 'forbidden', 'Apenas ADM Geral.')
    }

    const adminDb = createSupabaseAdmin()
    const { data, error } = await adminDb
      .from('empresa_auxiliar_adm_solicitacoes')
      .select(
        `
        id, empresa_id, assinatura_id, status, created_at,
        empresas ( id, nome_fantasia, nome_usuario, foto_url, usuario_id )
      `,
      )
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const items = (data ?? []).map((row) => {
      const empRaw = row.empresas
      const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as EmpresaJoin | null
      return {
        id: String(row.id),
        empresa_id: String(row.empresa_id),
        assinatura_id: row.assinatura_id != null ? String(row.assinatura_id) : null,
        created_at: String(row.created_at ?? ''),
        empresa: emp
          ? {
              empresa_id: emp.id,
              usuario_id: emp.usuario_id,
              nome: emp.nome_fantasia ?? 'Empresa',
              username: emp.nome_usuario ?? '',
              foto_url: emp.foto_url,
            }
          : null,
      }
    })

    return NextResponse.json({ ok: true, items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Atribui moderador (admin_level 2) a uma solicitação Auxiliar ADM. */
export async function POST(req: Request) {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error

    const { row: adminRow, actorId } = await loadAdminUsuarioRow(auth.userId, auth.email)
    if (!isAdminGeral(adminRow)) {
      return jsonAdminError(403, 'forbidden', 'Apenas ADM Geral.')
    }

    const body = (await req.json()) as Record<string, unknown>
    const solicitacaoId = String(body.solicitacao_id ?? '').trim()
    const moderadorUsuarioId = String(body.moderador_usuario_id ?? '').trim()
    if (!solicitacaoId || !moderadorUsuarioId) {
      return NextResponse.json({ error: 'solicitacao_id e moderador_usuario_id são obrigatórios.' }, { status: 400 })
    }

    const adminDb = createSupabaseAdmin()
    const { data: sol, error: solErr } = await adminDb
      .from('empresa_auxiliar_adm_solicitacoes')
      .select('id, empresa_id, status')
      .eq('id', solicitacaoId)
      .maybeSingle()

    if (solErr || !sol) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }
    if (String(sol.status) !== 'pendente') {
      return NextResponse.json({ error: 'Solicitação já processada.' }, { status: 400 })
    }

    const { data: moderador } = await adminDb
      .from('usuarios')
      .select('id, role')
      .eq('id', moderadorUsuarioId)
      .maybeSingle()

    if (!moderador?.id) {
      return NextResponse.json({ error: 'Usuário moderador não encontrado.' }, { status: 404 })
    }

    const agora = new Date().toISOString()

    const { error: upMod } = await adminDb
      .from('usuarios')
      .update({ role: 'admin', admin_level: 2 })
      .eq('id', moderadorUsuarioId)

    if (upMod) return NextResponse.json({ error: upMod.message }, { status: 500 })

    const { error: upSol } = await adminDb
      .from('empresa_auxiliar_adm_solicitacoes')
      .update({
        status: 'atribuido',
        moderador_usuario_id: moderadorUsuarioId,
        atribuido_por: actorId,
        atribuido_em: agora,
        updated_at: agora,
      })
      .eq('id', solicitacaoId)
      .eq('status', 'pendente')

    if (upSol) return NextResponse.json({ error: upSol.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
