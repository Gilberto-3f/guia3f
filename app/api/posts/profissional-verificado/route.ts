import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'

type Body = {
  profissionalId?: unknown
}

/**
 * Cria post de anúncio no feed após aprovação admin (service role — contorna RLS de insert em posts).
 * Chamado pelo dashboard após `aprovar` profissional.
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {
            /* só leitura da sessão */
          },
        },
      }
    )

    const {
      data: { user },
      error: authErr,
    } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: rowUser } = await supabaseAuth.from('usuarios').select('role').eq('id', user.id).maybeSingle()
    if (String(rowUser?.role ?? '') !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    let body: Body = {}
    try {
      body = (await req.json()) as Body
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const profissionalId = typeof body.profissionalId === 'string' ? body.profissionalId.trim() : ''
    if (!profissionalId) {
      return NextResponse.json({ error: 'missing_profissionalId' }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const { data: prof, error: profErr } = await admin
      .from('profissionais')
      .select('usuario_id, nome_usuario, categorias')
      .eq('id', profissionalId)
      .maybeSingle()

    if (profErr || !prof?.usuario_id) {
      return NextResponse.json({ error: 'profissional_not_found' }, { status: 404 })
    }

    const usuarioId = String(prof.usuario_id)
    const nomeUsuario = String(prof.nome_usuario ?? '').trim().replace(/^@+/, '')
    const categorias = prof.categorias
    const categoriaRotulo = formatProfissionalCategorias(categorias)

    const texto = `@${nomeUsuario || 'usuario'} agora é um profissional verificado da plataforma`

    const { data: inserted, error: insErr } = await admin
      .from('posts')
      .insert({
        autor_id: usuarioId,
        tipo: 'verificacao_profissional',
        texto,
        avaliacao_meta: {
          verificacao_profissional: true,
          categoria_rotulo: categoriaRotulo,
          categorias,
        },
      })
      .select('id')
      .maybeSingle()

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, postId: inserted?.id ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('em falta')) {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
