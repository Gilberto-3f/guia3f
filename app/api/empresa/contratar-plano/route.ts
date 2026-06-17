import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { contratarPlanoEmpresa, type ModalidadePlanoEmpresa } from '@/lib/contratarPlanoEmpresa'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Empresa contrata plano do catálogo ADM (aba Planos do canal financeiro). */
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
      return NextResponse.json({ error: 'Apenas empresas podem contratar planos.' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const planoId = String(body.plano_id ?? '').trim()
    const modalidade = String(body.modalidade ?? '') as ModalidadePlanoEmpresa

    if (!planoId) {
      return NextResponse.json({ error: 'plano_id é obrigatório.' }, { status: 400 })
    }

    const res = await contratarPlanoEmpresa(supabase, {
      empresaUsuarioId: user.id,
      planoId,
      modalidade,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Não foi possível contratar.' }, { status: 400 })
    }

    if (res.empresaId) {
      try {
        const admin = createSupabaseAdmin()
        await admin
          .from('empresa_degustacoes')
          .update({ status: 'cancelada', updated_at: new Date().toISOString() })
          .eq('empresa_id', res.empresaId)
          .eq('status', 'ativa')
      } catch {
        /* degustação ativa pode não existir */
      }
    }

    return NextResponse.json({ ok: true, plano_titulo: res.planoTitulo })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
