import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  notificarEmpresasParceriaComissaoDividida,
  processarContratacaoRecomendacaoProfissional,
} from '@/lib/parceriaRecomendacaoContratacao'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'
import {
  hrefDestinoContratacao,
  precisaDadosPaxManifesto,
  resolverDestinoContratacaoRecomendacao,
} from '@/lib/recomendacaoContratacaoDestino'

/** Turista contrata profissional via link de recomendação (ref=recomendacao&rec=). */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'turista') {
    return NextResponse.json({ error: 'Apenas turistas podem contratar por recomendação.' }, { status: 403 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const recomendacaoId = String(body.recomendacao_id ?? body.rec ?? '').trim()
  const profissionalIndicadoUsuarioId = String(body.profissional_usuario_id ?? '').trim()
  const pontoPartida = body.ponto_partida != null ? String(body.ponto_partida) : null
  const atrativos = Array.isArray(body.atrativos) ? body.atrativos.map(String) : []
  const nomeCompleto = String(body.nome_completo ?? '').trim()
  const documento = body.documento != null ? String(body.documento).trim() : null
  const dataNascimento = body.data_nascimento != null ? String(body.data_nascimento).slice(0, 10) : null

  if (!recomendacaoId || !profissionalIndicadoUsuarioId) {
    return NextResponse.json({ error: 'recomendacao_id e profissional_usuario_id obrigatórios.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: recMeta } = await admin
    .from('recomendacoes_profissional')
    .select(
      `
      id,
      profissional_indicado:profissional_indicado_id (
        id, usuario_id, categorias, placa_vermelha, empresa_hospedagem_id
      )
    `,
    )
    .eq('id', recomendacaoId)
    .maybeSingle()

  const indicadoMeta = joinSupabaseRow(recMeta?.profissional_indicado)
  if (!indicadoMeta || String(indicadoMeta.usuario_id) !== profissionalIndicadoUsuarioId) {
    return NextResponse.json({ error: 'Recomendação inválida.' }, { status: 400 })
  }

  const placaVermelha = Boolean(indicadoMeta.placa_vermelha)
  const cats = Array.isArray(indicadoMeta.categorias) ? indicadoMeta.categorias.map(String) : []

  if (precisaDadosPaxManifesto(cats, placaVermelha)) {
    if (!nomeCompleto || !dataNascimento || !documento) {
      return NextResponse.json(
        { error: 'Nome completo, data de nascimento e documento são obrigatórios.' },
        { status: 400 },
      )
    }
  }

  const { data: cfg } = await admin
    .from('config_apis')
    .select('api_mobilidade_url')
    .limit(1)
    .maybeSingle()

  const destino = resolverDestinoContratacaoRecomendacao({
    categoriasIndicado: cats,
    placaVermelhaIndicado: placaVermelha,
    empresaHospedagemId:
      indicadoMeta.empresa_hospedagem_id != null ? String(indicadoMeta.empresa_hospedagem_id) : null,
    profissionalUsuarioId: profissionalIndicadoUsuarioId,
    apiMobilidadeUrl: cfg?.api_mobilidade_url != null ? String(cfg.api_mobilidade_url) : null,
  })

  const res = await processarContratacaoRecomendacaoProfissional(admin, {
    turistaUsuarioId: auth.userId,
    recomendacaoId,
    profissionalIndicadoUsuarioId,
    pontoPartida,
    atrativos,
    dadosPax:
      nomeCompleto && dataNascimento && documento
        ? {
            nome: nomeCompleto,
            documento,
            data_nascimento: dataNascimento,
            validada: true,
          }
        : undefined,
  })

  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'Erro ao contratar.' }, { status: 400 })
  }

  const { data: rec } = await admin
    .from('recomendacoes_profissional')
    .select('profissional_indicador:profissional_indicador_id (usuario_id)')
    .eq('id', recomendacaoId)
    .maybeSingle()

  const indicador = joinSupabaseRow(rec?.profissional_indicador)
  const indicadorUsuarioId = indicador?.usuario_id != null ? String(indicador.usuario_id) : ''

  if (indicadorUsuarioId) {
    await notificarEmpresasParceriaComissaoDividida(admin, {
      turistaUsuarioId: auth.userId,
      indicadorUsuarioId,
      indicadoUsuarioId: profissionalIndicadoUsuarioId,
      recomendacaoId,
    })
  }

  return NextResponse.json({
    ok: true,
    parceria_id: res.parceriaId,
    manifesto_id: res.manifestoId ?? null,
    destino,
    redirect: hrefDestinoContratacao(destino),
    api_url: destino.tipo === 'api_parceiro' ? destino.url : null,
  })
}
