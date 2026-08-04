import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { avancarFilaSeExpirada } from '@/lib/mobilidadeMatching'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { id } = await ctx.params
  const solicitacaoId = String(id ?? '').trim()
  if (!solicitacaoId) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
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
      'id, turista_id, status, modalidade, valor_estimado, oferta_expira_em, oferta_profissional_id, profissional_id, fila_profissional_ids, fila_indice, metadata',
    )
    .eq('id', solicitacaoId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
  }

  const isTurista = String(row.turista_id) === auth.userId
  let isProfOferta = false
  if (auth.role === 'profissional') {
    const { data: p } = await admin
      .from('profissionais')
      .select('id')
      .eq('usuario_id', auth.userId)
      .maybeSingle()
    if (p?.id && String(row.oferta_profissional_id) === String(p.id)) isProfOferta = true
    if (p?.id && String(row.profissional_id) === String(p.id)) isProfOferta = true
  }

  if (!isTurista && !isProfOferta && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  let status = String(row.status)
  let oferta = null as Awaited<ReturnType<typeof avancarFilaSeExpirada>>['oferta']
  let profissionalWhatsapp: string | null = null
  let profissionalUsername: string | null = null

  if (status === 'oferecida') {
    const avancou = await avancarFilaSeExpirada(admin, solicitacaoId)
    status = avancou.status
    oferta = avancou.oferta
  } else if (
    (status === 'aceita' ||
      status === 'a_caminho' ||
      status === 'no_local' ||
      status === 'em_viagem') &&
    row.profissional_id
  ) {
    const { data: p } = await admin
      .from('profissionais')
      .select('id, nome_completo, nome_usuario, foto_perfil_url, foto_url, telefone')
      .eq('id', row.profissional_id)
      .maybeSingle()
    if (p) {
      profissionalUsername = p.nome_usuario != null ? String(p.nome_usuario) : null
      profissionalWhatsapp =
        p.telefone != null && String(p.telefone).trim() ? String(p.telefone).trim() : null
      oferta = {
        profissionalId: String(p.id),
        nome: String(p.nome_completo ?? ''),
        username: profissionalUsername,
        fotoUrl:
          p.foto_perfil_url != null
            ? String(p.foto_perfil_url)
            : p.foto_url != null
              ? String(p.foto_url)
              : null,
        distanciaKm: 0,
        expiraEm: '',
      }
    }
  }

  let conversaId: string | null = null
  if (
    status === 'aceita' ||
    status === 'a_caminho' ||
    status === 'no_local' ||
    status === 'em_viagem'
  ) {
    const { data: conv } = await admin
      .from('mobilidade_conversas')
      .select('id')
      .eq('solicitacao_id', solicitacaoId)
      .maybeSingle()
    conversaId = conv?.id != null ? String(conv.id) : null
  }

  const filaLen = Array.isArray(row.fila_profissional_ids) ? row.fila_profissional_ids.length : 0
  const idx = Number(row.fila_indice ?? 0)
  const backupsRestantes = Math.max(0, Math.min(2, filaLen - idx - 1))

  return NextResponse.json({
    ok: true,
    id: row.id,
    status,
    modalidade: row.modalidade,
    valor_estimado: row.valor_estimado != null ? Number(row.valor_estimado) : null,
    oferta,
    backups_ocultos: backupsRestantes,
    oferta_expira_em: row.oferta_expira_em,
    conversa_id: conversaId,
    profissional_username: profissionalUsername,
    profissional_whatsapp: profissionalWhatsapp,
  })
}
