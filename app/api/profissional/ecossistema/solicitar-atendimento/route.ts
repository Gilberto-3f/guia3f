import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { criarSolicitacaoEOfertar } from '@/lib/mobilidadeMatching'
import { modalidadeDeCategoriasProfissional } from '@/lib/mobilidadePopupPesquisa'
import { abrirParceriaEmAndamentoPorRecomendacao } from '@/lib/parceriaRecomendacaoContratacao'
import { profissionalRecursosLiberados } from '@/lib/verificacao-documentos'

/**
 * Recomendação direcionada (Ecossistema):
 * profissional indicador solicita atendimento do parceiro para um turista já cadastrado.
 */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error
  if (auth.role !== 'profissional' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas profissionais.' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const profissionalIndicadoId = String(body.profissional_indicado_id ?? '').trim()
  const turistaUsuarioId = String(body.turista_usuario_id ?? '').trim()
  const dataAgendadaRaw =
    body.data_agendada != null && String(body.data_agendada).trim()
      ? String(body.data_agendada).trim()
      : null
  const origemNome =
    body.origem_nome != null && String(body.origem_nome).trim()
      ? String(body.origem_nome).trim()
      : 'A combinar'
  const destinoNome =
    body.destino_nome != null && String(body.destino_nome).trim()
      ? String(body.destino_nome).trim()
      : 'A combinar'

  if (!profissionalIndicadoId || !turistaUsuarioId) {
    return NextResponse.json(
      { error: 'profissional_indicado_id e turista_usuario_id obrigatórios.' },
      { status: 400 },
    )
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const [{ data: usuario }, { data: indicador }] = await Promise.all([
    admin.from('usuarios').select('status').eq('id', auth.userId).maybeSingle(),
    admin
      .from('profissionais')
      .select('id, status, docs_verificado, proxima_revisao_docs_em, categorias')
      .eq('usuario_id', auth.userId)
      .maybeSingle(),
  ])

  if (!indicador?.id) {
    return NextResponse.json({ error: 'Perfil profissional não encontrado.' }, { status: 404 })
  }
  if (!profissionalRecursosLiberados(usuario?.status, indicador)) {
    return NextResponse.json(
      { error: 'Conta profissional ainda não verificada.' },
      { status: 403 },
    )
  }

  const indicadorId = String(indicador.id)
  if (indicadorId === profissionalIndicadoId) {
    return NextResponse.json({ error: 'Não é possível indicar a si mesmo.' }, { status: 400 })
  }

  const { data: turista } = await admin
    .from('turistas')
    .select('usuario_id, nome_completo')
    .eq('usuario_id', turistaUsuarioId)
    .maybeSingle()
  if (!turista?.usuario_id) {
    return NextResponse.json({ error: 'Cliente turista não encontrado.' }, { status: 404 })
  }

  const { data: indicado } = await admin
    .from('profissionais')
    .select(
      'id, usuario_id, categorias, placa_vermelha, mobilidade_status, mobilidade_lat, mobilidade_lng, nome_completo',
    )
    .eq('id', profissionalIndicadoId)
    .maybeSingle()
  if (!indicado?.id) {
    return NextResponse.json({ error: 'Profissional indicado não encontrado.' }, { status: 404 })
  }

  const modalidade = modalidadeDeCategoriasProfissional(
    Array.isArray(indicado.categorias) ? indicado.categorias.map(String) : [],
    Boolean(indicado.placa_vermelha),
  )
  if (!modalidade || modalidade === 'motorista_app') {
    return NextResponse.json(
      { error: 'Este profissional não atende modalidades de atendimento no app.' },
      { status: 400 },
    )
  }

  const recPayload: Record<string, unknown> = {
    profissional_indicador_id: indicadorId,
    profissional_indicado_id: profissionalIndicadoId,
    origem_indicacao: 'ecossistema',
    turista_usuario_id: turistaUsuarioId,
  }

  let recInsert = await admin
    .from('recomendacoes_profissional')
    .insert(recPayload)
    .select('id')
    .maybeSingle()

  if (recInsert.error && String(recInsert.error.message ?? '').toLowerCase().includes('turista_usuario')) {
    const { turista_usuario_id: _t, ...semTurista } = recPayload
    recInsert = await admin.from('recomendacoes_profissional').insert(semTurista).select('id').maybeSingle()
  }
  if (recInsert.error && String(recInsert.error.message ?? '').toLowerCase().includes('origem_indicacao')) {
    const { origem_indicacao: _o, ...semOrigem } = recPayload
    delete (semOrigem as { turista_usuario_id?: unknown }).turista_usuario_id
    recInsert = await admin.from('recomendacoes_profissional').insert(semOrigem).select('id').maybeSingle()
  }

  if (recInsert.error || !recInsert.data?.id) {
    return NextResponse.json(
      { error: recInsert.error?.message ?? 'Falha ao registrar recomendação.' },
      { status: 500 },
    )
  }

  const recomendacaoId = String(recInsert.data.id)

  const pLat = Number(indicado.mobilidade_lat)
  const pLng = Number(indicado.mobilidade_lng)
  const temGps = Number.isFinite(pLat) && Number.isFinite(pLng)

  const result = await criarSolicitacaoEOfertar(
    admin,
    {
      turistaUsuarioId,
      modalidade,
      origemNome,
      destinoNome,
      origemLat: temGps ? pLat : null,
      origemLng: temGps ? pLng : null,
      destinoLat: null,
      destinoLng: null,
      destinoEmpresaId: null,
      cruzamentoFronteira: false,
      cidadeOrigem: null,
      valorEstimado: null,
      pagamento: null,
      lugares: 1,
      acompanhamentoGuia: false,
      dataAgendada: dataAgendadaRaw,
      recomendacaoId,
      profissionalFixadoId: profissionalIndicadoId,
    },
    null,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error, recomendacao_id: recomendacaoId }, { status: 400 })
  }

  const parceria = await abrirParceriaEmAndamentoPorRecomendacao(admin, {
    recomendacaoId,
    indicadorId,
    indicadoId: profissionalIndicadoId,
    turistaUsuarioId,
  })

  return NextResponse.json({
    ok: true,
    recomendacao_id: recomendacaoId,
    solicitacao_id: result.solicitacaoId,
    parceria_id: parceria.parceriaId ?? null,
    status: result.status,
    oferta: result.oferta,
    turista_nome: String(turista.nome_completo ?? 'Turista'),
    profissional_nome: String(indicado.nome_completo ?? 'Profissional'),
  })
}
