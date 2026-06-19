import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'

export type ManifestoProfRow = {
  id: string
  status: string
  pax_qtd: number
  created_at: string
  updated_at: string
  turista: { nome: string; username: string } | null
  dados_atendimento: Record<string, unknown>
  indicador_nome: string | null
}

export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const concluidos = url.searchParams.get('concluidos') === '1'

  const { data: prof } = await auth.supabase
    .from('profissionais')
    .select('id')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!prof?.id) {
    return NextResponse.json({ ok: true, manifestos: [] as ManifestoProfRow[] })
  }

  let q = auth.supabase
    .from('manifesto')
    .select(
      `
      id,
      status,
      pax_qtd,
      created_at,
      updated_at,
      dados_atendimento,
      turista_usuario_id,
      profissional_indicador:profissional_indicador_id (nome_completo)
    `,
    )
    .eq('profissional_id', String(prof.id))
    .order('created_at', { ascending: false })
    .limit(50)

  if (concluidos) {
    q = q.in('status', ['finalizado', 'confirmado'])
  } else {
    q = q.in('status', ['pendente', 'confirmado'])
  }

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const manifestos: ManifestoProfRow[] = []

  for (const row of data ?? []) {
    let turista: ManifestoProfRow['turista'] = null
    const dados =
      row.dados_atendimento && typeof row.dados_atendimento === 'object'
        ? (row.dados_atendimento as Record<string, unknown>)
        : {}

    if (row.turista_usuario_id) {
      const { data: t } = await auth.supabase
        .from('turistas')
        .select('nome_completo, nome_usuario')
        .eq('usuario_id', row.turista_usuario_id)
        .maybeSingle()
      if (t) {
        const un = t.nome_usuario != null ? String(t.nome_usuario).replace(/^@+/, '') : ''
        turista = {
          nome: String(t.nome_completo ?? dados.nome_completo ?? 'Turista'),
          username: un ? `@${un}` : String(dados.username ?? '—'),
        }
      }
    } else if (dados.nome_completo) {
      turista = {
        nome: String(dados.nome_completo),
        username: String(dados.username ?? '—'),
      }
    }

    const indicador = row.profissional_indicador as { nome_completo?: string } | null

    manifestos.push({
      id: String(row.id),
      status: String(row.status),
      pax_qtd: Number(row.pax_qtd) || 1,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at ?? row.created_at),
      turista,
      dados_atendimento: dados,
      indicador_nome: indicador?.nome_completo != null ? String(indicador.nome_completo) : null,
    })
  }

  return NextResponse.json({ ok: true, manifestos })
}
