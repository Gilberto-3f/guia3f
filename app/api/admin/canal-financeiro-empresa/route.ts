import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import type { TipoNotificacaoFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'

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

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  const { data: rowUser } = await supabase.from('usuarios').select('role').eq('id', user.id).maybeSingle()
  if (String(rowUser?.role ?? '') !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }

  return { supabase, user }
}

const TIPOS_VALIDOS: TipoNotificacaoFinanceiroEmpresa[] = [
  'mensagem_adm',
  'comprovante_pagamento',
  'relatorio_pax',
  'relatorio_parceria',
  'extrato_comissao_paga',
  'pagamento_pendente',
  'plano_assinatura',
  'degustacao_plano',
  'lembrete_vencimento_plano',
]

/** ADM envia notificação ao canal financeiro privado de uma empresa. */
export async function POST(req: Request) {
  try {
    const auth = await assertAdminSession()
    if ('error' in auth && auth.error) return auth.error

    const body = (await req.json()) as Record<string, unknown>
    const empresaUsuarioId = String(body.empresa_usuario_id ?? '').trim()
    const titulo = String(body.titulo ?? '').trim()
    const mensagem = body.mensagem != null ? String(body.mensagem) : null
    const tipoRaw = String(body.tipo ?? 'mensagem_adm').trim() as TipoNotificacaoFinanceiroEmpresa
    const valor = body.valor != null ? Number(body.valor) : null

    if (!empresaUsuarioId || !titulo) {
      return NextResponse.json({ error: 'empresa_usuario_id e titulo são obrigatórios.' }, { status: 400 })
    }

    if (!TIPOS_VALIDOS.includes(tipoRaw)) {
      return NextResponse.json({ error: 'tipo inválido.' }, { status: 400 })
    }

    const res = await inserirNotificacaoCanalFinanceiroEmpresa(auth.supabase, {
      empresaUsuarioId,
      tipo: tipoRaw,
      titulo,
      mensagem,
      valor: Number.isFinite(valor) ? valor : null,
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
