import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { carregarBloqueiosMobilidade, hojeIsoLocal } from '@/lib/mobilidadeBloqueiosCalendario'

/**
 * GET ?profissional_id= — bloqueios futuros do profissional (leitura).
 * Dias sem bloqueio = disponíveis para pré-agendamento (modelo hospedagem).
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

  const bloqueios = await carregarBloqueiosMobilidade(admin, profissionalId, {
    aPartirDe: hojeIsoLocal(),
  })

  return NextResponse.json({
    ok: true,
    placa_vermelha: Boolean(prof.placa_vermelha),
    nome: String(prof.nome_completo ?? ''),
    username: prof.nome_usuario != null ? String(prof.nome_usuario).replace(/^@+/, '') : null,
    bloqueios,
    /** Compat UI antiga. */
    slots: [],
  })
}
