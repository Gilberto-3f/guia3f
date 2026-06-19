import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { repararLeituraDegustacaoConcluidaEmpresa } from '@/lib/canalFinanceiroEmpresaLeitura.server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Repara canal_financeiro de degustações já aceitas/encerradas (não marca convites pendentes). */
export async function POST() {
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

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', user.id).maybeSingle()
    const empresaId = emp?.id != null ? String(emp.id) : ''
    if (!empresaId) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const admin = createSupabaseAdmin()
    await repararLeituraDegustacaoConcluidaEmpresa(admin, empresaId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
