import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionalPlacaVermelha } from '@/lib/manifestoDiario'

export type PassageiroDisponivelRow = {
  turista_id: string
  nome: string
  username: string
  documento: string | null
  contratacao_tipo: string
  origem: string
}

/** Passageiros elegíveis para novo manifesto (contratados/agendados). */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const prof = await buscarProfissionalPlacaVermelha(auth.supabase, auth.userId)
  if (!prof?.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
  }

  const vistos = new Set<string>()
  const passageiros: PassageiroDisponivelRow[] = []

  const { data: legado } = await auth.supabase
    .from('manifesto')
    .select('turista_usuario_id, dados_atendimento, recomendacao_id, created_at')
    .eq('profissional_id', prof.id)
    .in('status', ['pendente', 'confirmado'])
    .order('created_at', { ascending: false })
    .limit(30)

  for (const m of legado ?? []) {
    const tid = m.turista_usuario_id != null ? String(m.turista_usuario_id) : ''
    if (!tid || vistos.has(tid)) continue
    vistos.add(tid)
    const dados =
      m.dados_atendimento && typeof m.dados_atendimento === 'object'
        ? (m.dados_atendimento as Record<string, unknown>)
        : {}
    passageiros.push({
      turista_id: tid,
      nome: String(dados.nome_completo ?? 'Turista'),
      username: String(dados.username ?? '—'),
      documento: dados.documento != null ? String(dados.documento) : null,
      contratacao_tipo: m.recomendacao_id ? 'indicacao' : 'contratacao_direta',
      origem: 'manifesto_legado',
    })
  }

  const { data: mobilidade } = await auth.supabase
    .from('solicitacao_mobilidade')
    .select('turista_id, status, created_at')
    .eq('profissional_id', prof.id)
    .in('status', ['aceita', 'a_caminho', 'no_local', 'em_viagem', 'concluida', 'concluido', 'finalizada'])
    .order('created_at', { ascending: false })
    .limit(30)

  for (const s of mobilidade ?? []) {
    const tid = s.turista_id != null ? String(s.turista_id) : ''
    if (!tid || vistos.has(tid)) continue
    vistos.add(tid)

    const { data: tur } = await auth.supabase
      .from('turistas')
      .select('nome_completo, nome_usuario, documento_identidade')
      .eq('usuario_id', tid)
      .maybeSingle()

    const un = tur?.nome_usuario != null ? String(tur.nome_usuario).replace(/^@+/, '') : ''
    passageiros.push({
      turista_id: tid,
      nome: String(tur?.nome_completo ?? 'Turista'),
      username: un ? `@${un}` : '—',
      documento: tur?.documento_identidade != null ? String(tur.documento_identidade) : null,
      contratacao_tipo: 'algoritmo',
      origem: 'mobilidade',
    })
  }

  return NextResponse.json({ ok: true, passageiros })
}
