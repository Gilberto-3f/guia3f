import { NextResponse } from 'next/server'
import { assertUserSessionLight } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarCorridaAtivaProfissional } from '@/lib/mobilidadeCorrida'
import { peekListaManifestoHoje } from '@/lib/manifestoLista'
import { profissionalIdPorUsuario } from '@/lib/profissionalIdCache'

/** Corrida aceita do profissional logado (chat + concluir). */
export async function GET() {
  const auth = await assertUserSessionLight()
  if (!auth.ok) return auth.error

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const profId = await profissionalIdPorUsuario(admin, auth.userId)
  if (!profId) {
    return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 404 })
  }

  const lista = await peekListaManifestoHoje(admin, profId)
  const ativa = await buscarCorridaAtivaProfissional(admin, profId, lista?.daVezSolicitacaoId)
  return NextResponse.json({
    ok: true,
    lista_iniciada: Boolean(lista?.iniciada),
    manifesto_id: lista?.manifestoId ?? null,
    corrida: ativa
      ? {
          solicitacao_id: ativa.solicitacaoId,
          status: ativa.status,
          origem_nome: ativa.origemNome,
          destino_nome: ativa.destinoNome,
          destino_empresa_id: ativa.destinoEmpresaId,
          modalidade: ativa.modalidade,
          valor_estimado: ativa.valorEstimado,
          pagamento: ativa.pagamento,
          lugares: ativa.lugares,
          data_agendada: ativa.dataAgendada,
          conversa_id: ativa.conversaId,
          manifesto_id: ativa.manifestoId,
          lat_origem: ativa.latOrigem,
          lng_origem: ativa.lngOrigem,
          lat_destino: ativa.latDestino,
          lng_destino: ativa.lngDestino,
          prof_lat: ativa.profLat,
          prof_lng: ativa.profLng,
          turista: ativa.turista
            ? {
                usuario_id: ativa.turista.usuarioId,
                nome: ativa.turista.nome,
                username: ativa.turista.username,
                foto_url: ativa.turista.fotoUrl,
                verificado: ativa.turista.verificado,
                nota_media: ativa.turista.notaMedia,
              }
            : null,
        }
      : null,
  })
}
