import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarCorridaAtivaProfissional } from '@/lib/mobilidadeCorrida'

/** Corrida aceita do profissional logado (chat + concluir). */
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

  const ativa = await buscarCorridaAtivaProfissional(admin, String(prof.id))
  return NextResponse.json({
    ok: true,
    corrida: ativa
      ? {
          solicitacao_id: ativa.solicitacaoId,
          origem_nome: ativa.origemNome,
          destino_nome: ativa.destinoNome,
          modalidade: ativa.modalidade,
          valor_estimado: ativa.valorEstimado,
          conversa_id: ativa.conversaId,
          manifesto_id: ativa.manifestoId,
        }
      : null,
  })
}
