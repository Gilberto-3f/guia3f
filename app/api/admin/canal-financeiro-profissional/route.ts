import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import type { TipoNotificacaoFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { getUserFromCookieSession } from '@/lib/serverAuthSession'

async function assertAdminSession() {
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
    }
  )

  const { user, error: authErr } = await getUserFromCookieSession(supabase)
  if (authErr || !user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  const { data: rowUser } = await supabase.from('usuarios').select('role').eq('id', user.id).maybeSingle()
  if (String(rowUser?.role ?? '') !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }

  return { supabase, user }
}

const TIPOS_VALIDOS: TipoNotificacaoFinanceiroProfissional[] = [
  'mensagem_adm',
  'recibo_atendimento',
  'extrato_parceria',
  'extrato_comissao',
  'manifesto_indicacao',
]

/** ADM envia notificação ao canal financeiro privado de um profissional. */
export async function POST(req: Request) {
  try {
    const auth = await assertAdminSession()
    if ('error' in auth && auth.error) return auth.error

    const body = (await req.json()) as Record<string, unknown>
    const profissionalUsuarioId = String(body.profissional_usuario_id ?? '').trim()
    const titulo = String(body.titulo ?? '').trim()
    const mensagem = body.mensagem != null ? String(body.mensagem) : null
    const tipoRaw = String(body.tipo ?? 'mensagem_adm').trim() as TipoNotificacaoFinanceiroProfissional
    const empresaId = body.empresa_id != null ? String(body.empresa_id).trim() : null
    const valor = body.valor != null ? Number(body.valor) : null

    if (!profissionalUsuarioId || !titulo) {
      return NextResponse.json({ error: 'profissional_usuario_id e titulo são obrigatórios.' }, { status: 400 })
    }

    if (!TIPOS_VALIDOS.includes(tipoRaw)) {
      return NextResponse.json({ error: 'tipo inválido.' }, { status: 400 })
    }

    const res = await inserirNotificacaoCanalFinanceiroProfissional(auth.supabase, {
      profissionalUsuarioId,
      tipo: tipoRaw,
      titulo,
      mensagem,
      valor: Number.isFinite(valor) ? valor : null,
      empresaId: empresaId || null,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Erro ao enviar.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: res.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
