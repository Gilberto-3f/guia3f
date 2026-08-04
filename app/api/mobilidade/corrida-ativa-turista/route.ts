import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Corrida ativa do turista (chegada / viagem). */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'turista' && auth.role !== 'admin' && auth.role !== 'empresa') {
    return NextResponse.json({ error: 'Apenas contratantes.' }, { status: 403 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select(
      'id, status, origem_nome, destino_nome, modalidade, profissional_id, metadata',
    )
    .eq('turista_id', auth.userId)
    .in('status', ['aceita', 'a_caminho', 'no_local', 'em_viagem'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row?.id) {
    return NextResponse.json({ ok: true, corrida: null })
  }

  let profissionalUsername: string | null = null
  let profissionalWhatsapp: string | null = null
  let profissionalNome: string | null = null

  if (row.profissional_id) {
    const { data: p } = await admin
      .from('profissionais')
      .select('nome_completo, nome_usuario, telefone')
      .eq('id', row.profissional_id)
      .maybeSingle()
    if (p) {
      profissionalNome = p.nome_completo != null ? String(p.nome_completo) : null
      profissionalUsername = p.nome_usuario != null ? String(p.nome_usuario) : null
      profissionalWhatsapp =
        p.telefone != null && String(p.telefone).trim() ? String(p.telefone).trim() : null
    }
  }

  return NextResponse.json({
    ok: true,
    corrida: {
      solicitacao_id: String(row.id),
      status: String(row.status),
      origem_nome: row.origem_nome != null ? String(row.origem_nome) : null,
      destino_nome: row.destino_nome != null ? String(row.destino_nome) : null,
      modalidade: row.modalidade != null ? String(row.modalidade) : null,
      profissional_nome: profissionalNome,
      profissional_username: profissionalUsername,
      profissional_whatsapp: profissionalWhatsapp,
    },
  })
}
