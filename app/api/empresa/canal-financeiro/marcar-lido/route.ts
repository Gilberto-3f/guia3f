import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  marcarFinanceiroItemLidoEmpresa,
  marcarFinanceiroLidoEmpresa,
} from '@/lib/canaisEmpresaVisibilidade'

/** Empresa marca aviso(s) do canal financeiro como lido(s). */
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

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { data: urow } = await supabase.from('usuarios').select('role').eq('id', user.id).maybeSingle()
    if (String(urow?.role ?? '') !== 'empresa') {
      return NextResponse.json({ error: 'Apenas empresas podem marcar leitura.' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const itemId = String(body.item_id ?? '').trim()

    const ok = itemId
      ? await marcarFinanceiroItemLidoEmpresa(supabase, user.id, itemId)
      : await marcarFinanceiroLidoEmpresa(supabase, user.id)

    if (!ok) {
      return NextResponse.json({ error: 'Não foi possível marcar como lido.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
