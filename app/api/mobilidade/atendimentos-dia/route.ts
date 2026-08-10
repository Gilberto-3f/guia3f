import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export type AtendimentoDiaItem = {
  solicitacao_id: string
  status: string
  origem_nome: string | null
  destino_nome: string | null
  valor_estimado: number | null
  turista_nome: string | null
  turista_username: string | null
  turista_foto: string | null
  criado_em: string | null
  data_agendada: string | null
}

/** Atendimentos do dia do profissional (lista taxista).
 *  `?historico=1` → últimos 30 dias (sem filtro só de hoje).
 */
export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'profissional') {
    return NextResponse.json({ error: 'Apenas profissionais.' }, { status: 403 })
  }

  const historico = new URL(req.url).searchParams.get('historico') === '1'

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

  const hoje = new Date()
  const y = hoje.getFullYear()
  const m = String(hoje.getMonth() + 1).padStart(2, '0')
  const d = String(hoje.getDate()).padStart(2, '0')
  const dia = `${y}-${m}-${d}`

  const statuses = historico
    ? ['aceita', 'em_andamento', 'concluida', 'oferecida', 'agendada', 'aguardando_confirmacao', 'cancelada']
    : ['aceita', 'em_andamento', 'concluida', 'oferecida', 'agendada', 'aguardando_confirmacao']

  const { data: rows, error } = await admin
    .from('solicitacao_mobilidade')
    .select(
      'id, status, origem_nome, destino_nome, valor_estimado, turista_id, created_at, data_agendada',
    )
    .eq('profissional_id', prof.id)
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .limit(historico ? 120 : 80)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const limiteHistorico = new Date(hoje)
  limiteHistorico.setDate(limiteHistorico.getDate() - 30)
  const limiteIso = limiteHistorico.toISOString().slice(0, 10)

  const noDia = (iso: string | null | undefined) => {
    if (!iso) return false
    const s = String(iso)
    return s.slice(0, 10) === dia || s.includes(dia)
  }

  const noPeriodo = (iso: string | null | undefined) => {
    if (!iso) return false
    return String(iso).slice(0, 10) >= limiteIso
  }

  const rowsFiltrados = (rows ?? []).filter((r) => {
    const created = r.created_at != null ? String(r.created_at) : null
    const agendada = r.data_agendada != null ? String(r.data_agendada) : null
    if (historico) return noPeriodo(created) || noPeriodo(agendada)
    return noDia(created) || noDia(agendada)
  })

  const turistaIds = [
    ...new Set(
      rowsFiltrados
        .map((r) => (r.turista_id != null ? String(r.turista_id) : ''))
        .filter(Boolean),
    ),
  ]

  const perfilByUser = new Map<
    string,
    { nome: string | null; username: string | null; foto: string | null }
  >()

  if (turistaIds.length) {
    const { data: turistas } = await admin
      .from('turistas')
      .select('usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url')
      .in('usuario_id', turistaIds)

    for (const t of turistas ?? []) {
      const id = String(t.usuario_id)
      perfilByUser.set(id, {
        nome:
          t.nome_completo != null && String(t.nome_completo).trim()
            ? String(t.nome_completo)
            : null,
        username:
          t.nome_usuario != null && String(t.nome_usuario).trim()
            ? String(t.nome_usuario)
            : null,
        foto:
          t.foto_perfil_url != null
            ? String(t.foto_perfil_url)
            : t.foto_url != null
              ? String(t.foto_url)
              : null,
      })
    }
  }

  const atendimentos: AtendimentoDiaItem[] = rowsFiltrados.map((r) => {
    const tid = r.turista_id != null ? String(r.turista_id) : ''
    const p = tid ? perfilByUser.get(tid) : null
    return {
      solicitacao_id: String(r.id),
      status: String(r.status ?? ''),
      origem_nome: r.origem_nome != null ? String(r.origem_nome) : null,
      destino_nome: r.destino_nome != null ? String(r.destino_nome) : null,
      valor_estimado: r.valor_estimado != null ? Number(r.valor_estimado) : null,
      turista_nome: p?.nome ?? null,
      turista_username: p?.username ?? null,
      turista_foto: p?.foto ?? null,
      criado_em: r.created_at != null ? String(r.created_at) : null,
      data_agendada: r.data_agendada != null ? String(r.data_agendada) : null,
    }
  })

  return NextResponse.json({ ok: true, data: dia, historico, atendimentos })
}
