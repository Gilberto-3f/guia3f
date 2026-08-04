import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  criarSolicitacaoEOfertar,
  resolverProfissionalFixadoMobilidade,
  type SolicitarMobilidadeInput,
} from '@/lib/mobilidadeMatching'
import type { ModalidadeMobilidadeId } from '@/lib/mobilidadePopupPesquisa'
import { ehCruzamentoFronteira, inferirCidadeDePonto } from '@/lib/mobilidadePopupPesquisa'
import { normalizarMoedasPreferencia } from '@/lib/mobilidadePerfilProfissional'

const MODS = new Set(['motorista_app', 'van', 'taxista', 'guia'])

export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'turista' && auth.role !== 'admin' && auth.role !== 'empresa') {
    return NextResponse.json({ error: 'Apenas turistas podem solicitar corrida.' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const modalidade = String(body.modalidade ?? '').trim() as ModalidadeMobilidadeId
  if (!MODS.has(modalidade)) {
    return NextResponse.json({ error: 'Modalidade inválida.' }, { status: 400 })
  }

  const origem = {
    nome: String(body.origem_nome ?? '').trim(),
    lat: body.origem_lat != null ? Number(body.origem_lat) : null,
    lng: body.origem_lng != null ? Number(body.origem_lng) : null,
  }
  const destino = {
    nome: String(body.destino_nome ?? '').trim(),
    lat: body.destino_lat != null ? Number(body.destino_lat) : null,
    lng: body.destino_lng != null ? Number(body.destino_lng) : null,
  }

  const cidadeOrigem = inferirCidadeDePonto(origem)
  const cidadeDestino = inferirCidadeDePonto(
    destino,
    body.destino_cidade != null ? String(body.destino_cidade) : null,
  )
  const cruzamento =
    body.cruzamento_fronteira === true || ehCruzamentoFronteira(cidadeOrigem, cidadeDestino)

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: cfg } = await admin
    .from('config_apis')
    .select('api_mobilidade_url')
    .limit(1)
    .maybeSingle()

  const recRaw =
    body.recomendacao_id != null
      ? String(body.recomendacao_id).trim()
      : body.rec != null
        ? String(body.rec).trim()
        : ''
  const profUsuarioRaw =
    body.profissional_usuario_id != null
      ? String(body.profissional_usuario_id).trim()
      : body.contratar != null
        ? String(body.contratar).trim()
        : body.prof != null
          ? String(body.prof).trim()
          : ''

  const fixado = await resolverProfissionalFixadoMobilidade(admin, {
    recomendacaoId: recRaw || null,
    profissionalUsuarioId: profUsuarioRaw || null,
  })

  const input: SolicitarMobilidadeInput = {
    turistaUsuarioId: auth.userId,
    modalidade,
    origemNome: origem.nome || 'Origem',
    destinoNome: destino.nome || 'Destino',
    origemLat: origem.lat != null && Number.isFinite(origem.lat) ? origem.lat : null,
    origemLng: origem.lng != null && Number.isFinite(origem.lng) ? origem.lng : null,
    destinoLat: destino.lat != null && Number.isFinite(destino.lat) ? destino.lat : null,
    destinoLng: destino.lng != null && Number.isFinite(destino.lng) ? destino.lng : null,
    destinoEmpresaId:
      body.destino_empresa_id != null ? String(body.destino_empresa_id).trim() || null : null,
    cruzamentoFronteira: cruzamento,
    cidadeOrigem,
    valorEstimado:
      body.valor_estimado != null && Number.isFinite(Number(body.valor_estimado))
        ? Number(body.valor_estimado)
        : null,
    pagamento: body.pagamento != null ? String(body.pagamento) : null,
    lugares: Math.max(1, Number(body.lugares) || 1),
    acompanhamentoGuia: body.acompanhamento_guia === true,
    dataAgendada:
      body.data_agendada != null && String(body.data_agendada).trim()
        ? String(body.data_agendada)
        : null,
    recomendacaoId: fixado.recomendacaoId,
    profissionalFixadoId: fixado.profissionalId,
    idiomaPreferido:
      body.idioma_preferido != null && String(body.idioma_preferido).trim()
        ? String(body.idioma_preferido).trim().toLowerCase()
        : null,
    moedasDinheiro: normalizarMoedasPreferencia(body.moedas_dinheiro),
  }

  const res = await criarSolicitacaoEOfertar(
    admin,
    input,
    cfg?.api_mobilidade_url != null ? String(cfg.api_mobilidade_url) : null,
  )

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  return NextResponse.json(res)
}
