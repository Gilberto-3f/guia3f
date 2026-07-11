import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { persistirLeituraCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresaLeitura.server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getUserFromCookieSession } from '@/lib/serverAuthSession'

/** Empresa (ou anfitrião dual mode) marca aviso(s) do canal financeiro como lido(s). */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      },
    )

    const { user, error: authErr } = await getUserFromCookieSession(supabase)

    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { data: urow } = await supabase.from('usuarios').select('role').eq('id', user.id).maybeSingle()
    const role = String(urow?.role ?? '')

    let empresaId = ''

    if (role === 'empresa') {
      const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', user.id).maybeSingle()
      empresaId = emp?.id != null ? String(emp.id) : ''
    }

    // Profissional anfitrião (e fallback se role vier inconsistente): empresa de hospedagem vinculada.
    if (!empresaId && role !== 'turista' && role !== 'admin') {
      const { data: prof } = await supabase
        .from('profissionais')
        .select('empresa_hospedagem_id')
        .eq('usuario_id', user.id)
        .maybeSingle()
      const empHosp =
        prof?.empresa_hospedagem_id != null ? String(prof.empresa_hospedagem_id).trim() : ''
      if (empHosp) empresaId = empHosp
    }

    if (!empresaId) {
      // Nada a marcar no escopo empresa (ex.: anfitrião só no modo social).
      return NextResponse.json({ ok: true, skipped: true })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const itemId = String(body.item_id ?? '').trim() || undefined

    let admin
    try {
      admin = createSupabaseAdmin()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'service_role_unavailable'
      return NextResponse.json({ error: msg }, { status: 503 })
    }

    const ok = await persistirLeituraCanalFinanceiroEmpresa(admin, empresaId, itemId)
    if (!ok) {
      return NextResponse.json({ error: 'Não foi possível marcar como lido.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
