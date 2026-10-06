import { NextResponse } from 'next/server'
import { persistirLeituraCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresaLeitura.server'
import { aceitarDegustacaoEmpresa } from '@/lib/degustacaoEmpresa'
import { assertUserSession } from '@/lib/apiUserSession'

/** Empresa aceita convite de degustação no canal financeiro. */
export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    if (String(session.role ?? '') !== 'empresa') {
      return NextResponse.json({ error: 'Apenas empresas podem aceitar degustação.' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const degustacaoId = String(body.degustacao_id ?? '').trim()
    if (!degustacaoId) {
      return NextResponse.json({ error: 'degustacao_id é obrigatório.' }, { status: 400 })
    }

    const res = await aceitarDegustacaoEmpresa(session.supabase, {
      degustacaoId,
      empresaUsuarioId: session.userId,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Não foi possível aceitar.' }, { status: 400 })
    }

    const { data: emp } = await session.supabase
      .from('empresas')
      .select('id')
      .eq('usuario_id', session.userId)
      .maybeSingle()
    const empresaId = emp?.id != null ? String(emp.id) : ''
    if (empresaId) {
      try {
        await persistirLeituraCanalFinanceiroEmpresa(session.supabase, empresaId)
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
