import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * GET ?profissional_id= — slots ativos futuros de outro profissional (leitura).
 * Usado no drawer Ecossistema para ver a agenda do indicado.
 */
export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const profissionalId = String(new URL(req.url).searchParams.get('profissional_id') ?? '').trim()
  if (!profissionalId) {
    return NextResponse.json({ error: 'profissional_id obrigatório.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: prof } = await admin
    .from('profissionais')
    .select('id, placa_vermelha, nome_completo, nome_usuario')
    .eq('id', profissionalId)
    .maybeSingle()

  if (!prof?.id) {
    return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 404 })
  }

  if (!prof.placa_vermelha) {
    return NextResponse.json({
      ok: true,
      placa_vermelha: false,
      slots: [],
      mensagem: 'Este profissional não publica agenda de pré-agendamento (placa vermelha).',
    })
  }

  const hoje = new Date()
  const ymd = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const { data, error } = await admin
    .from('mobilidade_disponibilidade')
    .select('id, data, hora_inicio, hora_fim, vagas_total, vagas_ocupadas, ativo')
    .eq('profissional_id', profissionalId)
    .eq('ativo', true)
    .gte('data', ymd)
    .order('data', { ascending: true })
    .order('hora_inicio', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    placa_vermelha: true,
    nome: String(prof.nome_completo ?? ''),
    username: prof.nome_usuario != null ? String(prof.nome_usuario).replace(/^@+/, '') : null,
    slots: (data ?? []).map((s) => ({
      id: String(s.id),
      data: String(s.data),
      hora_inicio: String(s.hora_inicio).slice(0, 5),
      hora_fim: String(s.hora_fim).slice(0, 5),
      vagas_total: Number(s.vagas_total),
      vagas_ocupadas: Number(s.vagas_ocupadas),
      vagas_livres: Number(s.vagas_total) - Number(s.vagas_ocupadas),
      ativo: Boolean(s.ativo),
    })),
  })
}
