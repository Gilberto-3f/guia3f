import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { avancarFilaSeExpirada } from '@/lib/mobilidadeMatching'

/** Ofertas pendentes para o profissional logado. */
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
    return NextResponse.json({ ok: true, ofertas: [] })
  }

  const { data: rows } = await admin
    .from('solicitacao_mobilidade')
    .select(
      'id, status, modalidade, origem_nome, destino_nome, valor_estimado, lugares, oferta_expira_em, cruzamento_fronteira, lat_origem, lng_origem',
    )
    .eq('oferta_profissional_id', prof.id)
    .eq('status', 'oferecida')
    .order('created_at', { ascending: false })
    .limit(5)

  const ofertas = []
  for (const row of rows ?? []) {
    const avancou = await avancarFilaSeExpirada(admin, String(row.id))
    if (avancou.status !== 'oferecida') continue
    if (!avancou.oferta || avancou.oferta.profissionalId !== String(prof.id)) continue

    ofertas.push({
      solicitacao_id: row.id,
      modalidade: row.modalidade,
      origem_nome: row.origem_nome,
      destino_nome: row.destino_nome,
      valor_estimado: row.valor_estimado != null ? Number(row.valor_estimado) : null,
      lugares: row.lugares,
      cruzamento_fronteira: Boolean(row.cruzamento_fronteira),
      oferta_expira_em: row.oferta_expira_em,
      distancia_km: avancou.oferta.distanciaKm,
    })
  }

  return NextResponse.json({ ok: true, ofertas })
}
