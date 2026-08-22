import { NextResponse } from 'next/server'
import { assertUserSessionLight } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { mediaNotaAlvo } from '@/lib/notaMediaAvaliacoes'

/** Corrida ativa do turista (chegada / viagem / drawer de atendimento). */
export async function GET() {
  const auth = await assertUserSessionLight()
  if (!auth.ok) return auth.error

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select(
      'id, status, origem_nome, destino_nome, modalidade, valor_estimado, pagamento, lugares, data_agendada, profissional_id, metadata, destino_empresa_id, lat_origem, lng_origem, lat_destino, lng_destino',
    )
    .eq('turista_id', auth.userId)
    .in('status', ['aceita', 'a_caminho', 'no_local', 'em_viagem'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row?.id) {
    return NextResponse.json({ ok: true, corrida: null })
  }

  const numOrNull = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  let profissional: {
    usuario_id: string
    nome: string
    username: string | null
    foto_url: string | null
    verificado: boolean
    nota_media: number | null
    whatsapp: string | null
  } | null = null
  let profLat: number | null = null
  let profLng: number | null = null

  if (row.profissional_id) {
    const { data: p } = await admin
      .from('profissionais')
      .select(
        'usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, telefone, docs_verificado, placa_vermelha, mobilidade_lat, mobilidade_lng',
      )
      .eq('id', row.profissional_id)
      .maybeSingle()

    if (p?.usuario_id) {
      const uid = String(p.usuario_id)
      const notaMedia = await mediaNotaAlvo(admin, 'profissional', [
        uid,
        String(row.profissional_id),
      ])

      const foto =
        p.foto_perfil_url != null && String(p.foto_perfil_url).trim()
          ? String(p.foto_perfil_url)
          : p.foto_url != null && String(p.foto_url).trim()
            ? String(p.foto_url)
            : null

      profissional = {
        usuario_id: uid,
        nome: String(p.nome_completo ?? 'Profissional'),
        username: p.nome_usuario != null ? String(p.nome_usuario).replace(/^@+/, '') : null,
        foto_url: foto,
        verificado: Boolean(p.docs_verificado || p.placa_vermelha),
        nota_media: notaMedia,
        whatsapp:
          p.telefone != null && String(p.telefone).trim() ? String(p.telefone).trim() : null,
      }
      profLat = numOrNull(p.mobilidade_lat)
      profLng = numOrNull(p.mobilidade_lng)
    }
  }

  const { data: conv } = await admin
    .from('mobilidade_conversas')
    .select('id')
    .eq('solicitacao_id', row.id)
    .maybeSingle()

  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}

  return NextResponse.json({
    ok: true,
    corrida: {
      solicitacao_id: String(row.id),
      status: String(row.status),
      origem_nome: row.origem_nome != null ? String(row.origem_nome) : null,
      destino_nome: row.destino_nome != null ? String(row.destino_nome) : null,
      destino_empresa_id:
        row.destino_empresa_id != null ? String(row.destino_empresa_id) : null,
      manifesto_id: meta.manifesto_id != null ? String(meta.manifesto_id) : null,
      modalidade: row.modalidade != null ? String(row.modalidade) : null,
      valor_estimado: row.valor_estimado != null ? Number(row.valor_estimado) : null,
      pagamento: row.pagamento != null ? String(row.pagamento) : null,
      lugares: row.lugares != null ? Number(row.lugares) : null,
      data_agendada: row.data_agendada != null ? String(row.data_agendada) : null,
      conversa_id: conv?.id != null ? String(conv.id) : null,
      lat_origem: numOrNull(row.lat_origem),
      lng_origem: numOrNull(row.lng_origem),
      lat_destino: numOrNull(row.lat_destino),
      lng_destino: numOrNull(row.lng_destino),
      prof_lat: profLat,
      prof_lng: profLng,
      profissional_nome: profissional?.nome ?? null,
      profissional_username: profissional?.username ?? null,
      profissional_whatsapp: profissional?.whatsapp ?? null,
      profissional,
    },
  })
}
