import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { persistirLeituraCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresaLeitura.server'
import { aceitarDegustacaoEmpresa } from '@/lib/degustacaoEmpresa'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Empresa aceita convite de degustação no canal financeiro. */
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
      return NextResponse.json({ error: 'Apenas empresas podem aceitar degustação.' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const degustacaoId = String(body.degustacao_id ?? '').trim()
    if (!degustacaoId) {
      return NextResponse.json({ error: 'degustacao_id é obrigatório.' }, { status: 400 })
    }

    const res = await aceitarDegustacaoEmpresa(supabase, {
      degustacaoId,
      empresaUsuarioId: user.id,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Não foi possível aceitar.' }, { status: 400 })
    }

    const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', user.id).maybeSingle()
    const empresaId = emp?.id != null ? String(emp.id) : ''
    if (empresaId) {
      try {
        const admin = createSupabaseAdmin()
        await persistirLeituraCanalFinanceiroEmpresa(admin, empresaId)
      } catch (syncErr) {
        console.error('aceitar degustacao sync leitura:', syncErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
