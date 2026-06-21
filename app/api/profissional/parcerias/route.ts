import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

export type ParceriaEmAndamentoRow = {
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
  }
  turista: {
    nome: string
    username: string
  } | null
  contratado_em: string | null
}

/** Lista parcerias em andamento do profissional logado. */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { data: prof } = await auth.supabase
    .from('profissionais')
    .select('id')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!prof?.id) {
    return NextResponse.json({ ok: true, parcerias: [] as ParceriaEmAndamentoRow[] })
  }

  const profId = String(prof.id)

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
      recomendacao:recomendacao_id (contratado_em)
    `,
    )
    .or(`profissional_a_id.eq.${profId},profissional_b_id.eq.${profId}`)
    .in('status', ['em_andamento', 'fechada'])
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const parcerias: ParceriaEmAndamentoRow[] = []

  for (const row of rows ?? []) {
    const outroProfId =
      String(row.profissional_a_id) === profId
        ? String(row.profissional_b_id)
        : String(row.profissional_a_id)

    const { data: parceiro } = await auth.supabase
      .from('profissionais')
      .select('id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias')
      .eq('id', outroProfId)
      .maybeSingle()

    let turista: ParceriaEmAndamentoRow['turista'] = null
    if (row.turista_usuario_id) {
      const { data: t } = await auth.supabase
        .from('turistas')
        .select('nome_completo, nome_usuario')
        .eq('usuario_id', row.turista_usuario_id)
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
    const foto =
      parceiro?.foto_perfil_url != null
        ? String(parceiro.foto_perfil_url)
        : parceiro?.foto_url != null
          ? String(parceiro.foto_url)
          : null

    parcerias.push({
      id: String(row.id),
      status: String(row.status),
      created_at: String(row.created_at),
      turista_usuario_id: row.turista_usuario_id != null ? String(row.turista_usuario_id) : null,
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
      },
      turista,
      contratado_em: rec?.contratado_em != null ? String(rec.contratado_em) : null,
    })
  }

  return NextResponse.json({ ok: true, parcerias })
}
