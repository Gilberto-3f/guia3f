import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { carregarParceiroRecomendacaoOferta } from '@/lib/mobilidadeOfertaAtendimento'
import { mediaNotaAlvo } from '@/lib/notaMediaAvaliacoes'

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
      'id, status, modalidade, origem_nome, destino_nome, valor_estimado, lugares, pagamento, data_agendada, confirmacao_expira_em, turista_id, metadata, recomendacao_id',
    )
    .eq('profissional_id', prof.id)
    .in('status', ['agendada', 'aguardando_confirmacao'])
    .order('data_agendada', { ascending: true })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const agendamentos = []
  for (const r of data ?? []) {
    const uid = r.turista_id != null ? String(r.turista_id) : ''
    let turista = null
    if (uid) {
      const [{ data: tur }, nota_media] = await Promise.all([
        admin
          .from('turistas')
          .select('nome_completo, nome_usuario, foto_url, foto_perfil_url, docs_verificado')
          .eq('usuario_id', uid)
          .maybeSingle(),
        mediaNotaAlvo(admin, 'turista', [uid]),
      ])
      if (tur) {
        turista = {
          nome: String(tur.nome_completo ?? 'Turista'),
          username: tur.nome_usuario != null ? String(tur.nome_usuario) : null,
          foto_url:
            (tur.foto_perfil_url != null && String(tur.foto_perfil_url).trim()) ||
            (tur.foto_url != null && String(tur.foto_url).trim()) ||
            null,
          verificado: Boolean(tur.docs_verificado),
          nota_media,
        }
      }
    }
    const meta =
      typeof r.metadata === 'object' && r.metadata != null
        ? (r.metadata as Record<string, unknown>)
        : {}
    const recId = r.recomendacao_id != null ? String(r.recomendacao_id) : null
    const recomendacao = await carregarParceiroRecomendacaoOferta(admin, recId)
    agendamentos.push({
      solicitacao_id: String(r.id),
      status: String(r.status),
      modalidade: r.modalidade != null ? String(r.modalidade) : null,
      origem_nome: r.origem_nome != null ? String(r.origem_nome) : null,
      destino_nome: r.destino_nome != null ? String(r.destino_nome) : null,
      valor_estimado: r.valor_estimado != null ? Number(r.valor_estimado) : null,
      lugares: r.lugares != null ? Number(r.lugares) : 1,
      pagamento: r.pagamento != null ? String(r.pagamento) : null,
      data_agendada: r.data_agendada != null ? String(r.data_agendada) : null,
      confirmacao_expira_em:
        r.confirmacao_expira_em != null ? String(r.confirmacao_expira_em) : null,
      contratacao_direcionada: meta.contratacao_direcionada === true,
      recomendacao_id: recId,
      turista,
      recomendacao,
    })
  }

  return NextResponse.json({
    ok: true,
    agendamentos,
  })
}
