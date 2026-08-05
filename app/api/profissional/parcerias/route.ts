import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

export type ParceriaAtrativoRow = {
  empresa_id: string
  empresa_nome: string
  categoria: string
  visitado: boolean
  status: 'agendado' | 'visitado'
  selecionado_em: string
}

export type ParceriaRow = {
  id: string
  status: string
  created_at: string
  turista_usuario_id: string | null
  recomendacao_id: string | null
  parceiro: {
    profissional_id: string
    usuario_id: string
    nome: string
    username: string
    foto_url: string | null
    categorias: string
    whatsapp: string | null
  }
  turista: {
    nome: string
    username: string
  } | null
  contratado_em: string | null
  papel: 'indicador' | 'indicado' | 'parceiro'
  total_comissoes_estimadas: number | null
  atrativos: ParceriaAtrativoRow[]
  pagamento_confirmado: boolean
  recebimento_confirmado: boolean
  liquidado: boolean
}

async function buscarAtrativosParceria(
  supabase: Awaited<ReturnType<typeof assertUserSession>> extends infer R
    ? R extends { ok: true; supabase: infer S }
      ? S
      : never
    : never,
  profId: string,
  turistaUsuarioId: string | null,
  souIndicador: boolean,
): Promise<ParceriaAtrativoRow[]> {
  if (!turistaUsuarioId) return []

  let indiretoFilter = supabase
    .from('manifesto_passageiros')
    .select('manifesto_id')
    .eq('turista_id', turistaUsuarioId)

  if (souIndicador) {
    indiretoFilter = indiretoFilter.eq('profissional_indireto_id', profId)
  } else {
    const { data: mds } = await supabase
      .from('manifesto_diario')
      .select('id')
      .eq('profissional_id', profId)
    const ids = (mds ?? []).map((m) => String(m.id))
    if (ids.length === 0) return []
    indiretoFilter = supabase.from('manifesto_passageiros').select('manifesto_id').in('manifesto_id', ids).eq('turista_id', turistaUsuarioId)
  }

  const { data: passRows } = await indiretoFilter
  const manifestoIds = [...new Set((passRows ?? []).map((p) => String(p.manifesto_id)))]
  if (manifestoIds.length === 0) return []

  const { data: atrs } = await supabase
    .from('itinerario_paradas')
    .select(
      `
      empresa_id, visitado, selecionado_em,
      empresas:empresa_id (nome_fantasia, categoria)
    `,
    )
    .in('manifesto_id', manifestoIds)
    .eq('turista_id', turistaUsuarioId)

  return (atrs ?? []).map((a) => {
    const emp = joinSupabaseRow(a.empresas)
    return {
      empresa_id: String(a.empresa_id),
      empresa_nome: String(emp?.nome_fantasia ?? 'Empresa'),
      categoria: String(emp?.categoria ?? ''),
      visitado: Boolean(a.visitado),
      status: a.visitado ? ('visitado' as const) : ('agendado' as const),
      selecionado_em: String(a.selecionado_em ?? ''),
    }
  })
}

/** Lista parcerias do profissional (em andamento ou histórico). */
export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const historico = url.searchParams.get('historico') === '1'

  const { data: prof } = await auth.supabase
    .from('profissionais')
    .select('id')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!prof?.id) {
    return NextResponse.json({ ok: true, parcerias: [] as ParceriaRow[] })
  }

  const profId = String(prof.id)

  const statusFilter = historico ? ['concluida', 'fechada', 'cancelada'] : ['em_andamento', 'fechada']

  const { data: rows, error } = await auth.supabase
    .from('parcerias_profissionais')
    .select(
      `
      id,
      status,
      created_at,
      turista_usuario_id,
      recomendacao_id,
      profissional_a_id,
      profissional_b_id,
      pagamento_confirmado_em,
      recebimento_confirmado_em,
      liquidado_em,
      recomendacao:recomendacao_id (contratado_em, profissional_indicador_id)
    `,
    )
    .or(`profissional_a_id.eq.${profId},profissional_b_id.eq.${profId}`)
    .in('status', statusFilter)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const parcerias: ParceriaRow[] = []

  for (const row of rows ?? []) {
    const outroProfId =
      String(row.profissional_a_id) === profId
        ? String(row.profissional_b_id)
        : String(row.profissional_a_id)

    const { data: parceiro } = await auth.supabase
      .from('profissionais')
      .select('id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, whatsapp')
      .eq('id', outroProfId)
      .maybeSingle()

    let turista: ParceriaRow['turista'] = null
    const turistaId = row.turista_usuario_id != null ? String(row.turista_usuario_id) : null
    if (turistaId) {
      const { data: t } = await auth.supabase
        .from('turistas')
        .select('nome_completo, nome_usuario')
        .eq('usuario_id', turistaId)
        .maybeSingle()
      if (t) {
        const un = t.nome_usuario != null ? String(t.nome_usuario).replace(/^@+/, '') : ''
        turista = {
          nome: String(t.nome_completo ?? 'Turista'),
          username: un ? `@${un}` : '—',
        }
      }
    }

    const rec = joinSupabaseRow(row.recomendacao)
    const souIndicador = rec?.profissional_indicador_id != null && String(rec.profissional_indicador_id) === profId

    const foto =
      parceiro?.foto_perfil_url != null
        ? String(parceiro.foto_perfil_url)
        : parceiro?.foto_url != null
          ? String(parceiro.foto_url)
          : null

    const atrativos = await buscarAtrativosParceria(auth.supabase, profId, turistaId, Boolean(souIndicador))

    const papel: ParceriaRow['papel'] = souIndicador
      ? 'indicador'
      : String(row.profissional_a_id) === profId
        ? 'parceiro'
        : 'indicado'

    parcerias.push({
      id: String(row.id),
      status: String(row.status),
      created_at: String(row.created_at),
      turista_usuario_id: turistaId,
      recomendacao_id: row.recomendacao_id != null ? String(row.recomendacao_id) : null,
      parceiro: {
        profissional_id: outroProfId,
        usuario_id: String(parceiro?.usuario_id ?? ''),
        nome: String(parceiro?.nome_completo ?? 'Profissional'),
        username: String(parceiro?.nome_usuario ?? '').replace(/^@+/, ''),
        foto_url: foto,
        categorias: formatProfissionalCategorias(
          Array.isArray(parceiro?.categorias) ? parceiro.categorias.map(String) : [],
        ),
        whatsapp: parceiro?.whatsapp != null ? String(parceiro.whatsapp) : null,
      },
      turista,
      contratado_em: rec?.contratado_em != null ? String(rec.contratado_em) : null,
      papel,
      total_comissoes_estimadas: historico ? atrativos.filter((a) => a.visitado).length : null,
      atrativos,
      pagamento_confirmado: Boolean(row.pagamento_confirmado_em),
      recebimento_confirmado: Boolean(row.recebimento_confirmado_em),
      liquidado: Boolean(row.liquidado_em),
    })
  }

  return NextResponse.json({ ok: true, parcerias })
}
