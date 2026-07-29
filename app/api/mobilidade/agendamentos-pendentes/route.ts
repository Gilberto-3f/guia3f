import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Agendamentos pendentes do profissional (para confirmar / cancelar). */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'profissional') {
    return NextResponse.json({ error: 'Apenas profissionais.' }, { status: 403 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: prof } = await admin
    .from('profissionais')
    .select('id')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!prof?.id) {
    return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('solicitacao_mobilidade')
    .select(
      'id, status, modalidade, origem_nome, destino_nome, valor_estimado, lugares, data_agendada, confirmacao_expira_em',
    )
    .eq('profissional_id', prof.id)
    .in('status', ['agendada', 'aguardando_confirmacao'])
    .order('data_agendada', { ascending: true })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    agendamentos: (data ?? []).map((r) => ({
      solicitacao_id: String(r.id),
      status: String(r.status),
      modalidade: r.modalidade != null ? String(r.modalidade) : null,
      origem_nome: r.origem_nome != null ? String(r.origem_nome) : null,
      destino_nome: r.destino_nome != null ? String(r.destino_nome) : null,
      valor_estimado: r.valor_estimado != null ? Number(r.valor_estimado) : null,
      lugares: r.lugares != null ? Number(r.lugares) : 1,
      data_agendada: r.data_agendada != null ? String(r.data_agendada) : null,
      confirmacao_expira_em:
        r.confirmacao_expira_em != null ? String(r.confirmacao_expira_em) : null,
    })),
  })
}
