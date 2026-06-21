import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

/** Dados do popup de contratação (link ref=recomendacao&rec=). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const recId = String(url.searchParams.get('rec') ?? '').trim()
  const indicadoUsuarioId = String(url.searchParams.get('indicado') ?? '').trim()

  if (!recId || !indicadoUsuarioId) {
    return NextResponse.json({ error: 'rec e indicado obrigatórios.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: rec, error } = await admin
    .from('recomendacoes_profissional')
    .select(
      `
      id,
      contratado_em,
      profissional_indicador:profissional_indicador_id (
        id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias
      ),
      profissional_indicado:profissional_indicado_id (
        id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, placa_vermelha
      )
    `,
    )
    .eq('id', recId)
    .maybeSingle()

  if (error || !rec) {
    return NextResponse.json({ error: 'Recomendação não encontrada.' }, { status: 404 })
  }

  const indicado = joinSupabaseRow(rec.profissional_indicado)
  if (!indicado || String(indicado.usuario_id) !== indicadoUsuarioId) {
    return NextResponse.json({ error: 'Recomendação inválida para este perfil.' }, { status: 400 })
  }

  const indicador = joinSupabaseRow(rec.profissional_indicador)

  const mapProf = (p: Record<string, unknown> | null, notaMedia = 0, totalAval = 0) => {
    if (!p) return null
    const foto =
      p.foto_perfil_url != null
        ? String(p.foto_perfil_url)
        : p.foto_url != null
          ? String(p.foto_url)
          : null
    const cats = Array.isArray(p.categorias) ? p.categorias.map(String) : []
    return {
      id: String(p.id),
      usuario_id: String(p.usuario_id),
      nome: String(p.nome_completo ?? 'Profissional'),
      username: String(p.nome_usuario ?? '').replace(/^@+/, ''),
      foto_url: foto,
      categorias: formatProfissionalCategorias(cats),
      nota_media: notaMedia,
      total_avaliacoes: totalAval,
    }
  }

  const profIds = [indicador?.id, indicado?.id].filter(Boolean).map(String)
  const { data: avs } = await admin
    .from('avaliacoes')
    .select('alvo_id, nota')
    .eq('alvo_tipo', 'profissional')
    .in('alvo_id', profIds)

  const notasPorProf = new Map<string, number[]>()
  for (const a of avs ?? []) {
    const aid = String(a.alvo_id)
    const nota = Number(a.nota)
    if (!Number.isFinite(nota)) continue
    if (!notasPorProf.has(aid)) notasPorProf.set(aid, [])
    notasPorProf.get(aid)!.push(nota)
  }

  const media = (pid: string) => {
    const ns = notasPorProf.get(pid) ?? []
    return ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0
  }

  const indicadorId = indicador?.id != null ? String(indicador.id) : ''
  const indicadoId = indicado?.id != null ? String(indicado.id) : ''

  return NextResponse.json({
    ok: true,
    recomendacao_id: recId,
    ja_contratado: Boolean(rec.contratado_em),
    indicador: mapProf(indicador, media(indicadorId), (notasPorProf.get(indicadorId) ?? []).length),
    indicado: mapProf(indicado, media(indicadoId), (notasPorProf.get(indicadoId) ?? []).length),
  })
}
