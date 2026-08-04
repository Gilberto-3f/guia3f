import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { avancarFilaSeExpirada, solicitacaoEhContratacaoDirecionada } from '@/lib/mobilidadeMatching'
import { carregarParceiroRecomendacaoOferta } from '@/lib/mobilidadeOfertaAtendimento'
import { carregarParceiroRecomendacaoOferta } from '@/lib/mobilidadeOfertaAtendimento'
import { carregarParceiroRecomendacaoOferta } from '@/lib/mobilidadeOfertaAtendimento'

async function carregarTuristaOferta(
  admin: ReturnType<typeof createSupabaseAdmin>,
  turistaUsuarioId: string | null | undefined,
) {
  const uid = String(turistaUsuarioId ?? '').trim()
  if (!uid) return null

  const [{ data: tur }, { data: usu }] = await Promise.all([
    admin
      .from('turistas')
      .select('nome_completo, nome_usuario, foto_url, foto_perfil_url, docs_verificado')
      .eq('usuario_id', uid)
      .maybeSingle(),
    admin.from('usuarios').select('email').eq('id', uid).maybeSingle(),
  ])

  const foto =
    (tur?.foto_perfil_url != null && String(tur.foto_perfil_url).trim()) ||
    (tur?.foto_url != null && String(tur.foto_url).trim()) ||
    null
  const nome =
    tur?.nome_completo != null && String(tur.nome_completo).trim()
      ? String(tur.nome_completo)
      : usu?.email
        ? String(usu.email).split('@')[0]
        : 'Turista'
  const username =
    tur?.nome_usuario != null && String(tur.nome_usuario).trim()
      ? String(tur.nome_usuario)
      : null

  return {
    nome,
    username,
    foto_url: foto,
    verificado: Boolean(tur?.docs_verificado),
  }
}

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
      'id, status, modalidade, origem_nome, destino_nome, valor_estimado, lugares, pagamento, data_agendada, oferta_expira_em, cruzamento_fronteira, lat_origem, lng_origem, turista_id, metadata, recomendacao_id',
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

    const turista = await carregarTuristaOferta(admin, row.turista_id != null ? String(row.turista_id) : null)
    const meta =
      typeof row.metadata === 'object' && row.metadata != null
        ? (row.metadata as Record<string, unknown>)
        : {}

    const recId = row.recomendacao_id != null ? String(row.recomendacao_id) : null
    const recomendacao = await carregarParceiroRecomendacaoOferta(admin, recId)

    ofertas.push({
      solicitacao_id: row.id,
      modalidade: row.modalidade,
      origem_nome: row.origem_nome,
      destino_nome: row.destino_nome,
      valor_estimado: row.valor_estimado != null ? Number(row.valor_estimado) : null,
      lugares: row.lugares,
      pagamento: row.pagamento != null ? String(row.pagamento) : null,
      data_agendada: row.data_agendada != null ? String(row.data_agendada) : null,
      cruzamento_fronteira: Boolean(row.cruzamento_fronteira),
      oferta_expira_em: row.oferta_expira_em,
      distancia_km: avancou.oferta.distanciaKm,
      contratacao_direcionada: solicitacaoEhContratacaoDirecionada({
        metadata: meta,
      }),
      recomendacao_id: recId,
      turista,
      recomendacao,
    })
  }

  return NextResponse.json({ ok: true, ofertas })
}
