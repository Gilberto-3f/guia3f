import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import {
  buscarProfissionalPlacaVermelha,
  filtrarEmpresaIds,
  inserirParadasItinerario,
  inserirPassageiroManifesto,
  rotuloContratacao,
} from '@/lib/manifestoDiario'
import { listarParadasManifesto, type ParadaItinerarioRow } from '@/lib/itinerarioParadas'
import { profissionalEhGuia } from '@/lib/profissionalCategoriaManifesto'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

export type ManifestoPassageiroRow = {
  id: string
  ordem: number
  turista_id: string | null
  nome: string
  nome_social: string | null
  username: string | null
  documento: string | null
  data_nascimento: string | null
  foto_url: string | null
  contratacao_validada: boolean
  contratacao_tipo: string
  contratacao_rotulo: string
  profissional_indireto_nome: string | null
  entrou_em: string
  qtd_paradas: number
  status_fila: 'pendente' | 'recebido' | 'cancelado'
  solicitacao_id: string | null
}

export type ManifestoDiarioRow = {
  id: string
  data_manifesto: string
  status: string
  criado_em: string
  confirmado_em: string | null
  concluido_em: string | null
  lista_iniciada_em: string | null
  eh_guia: boolean
  qtd_passageiros: number
  qtd_paradas: number
  passageiros: ManifestoPassageiroRow[]
  itinerario: ParadaItinerarioRow[]
  /** @deprecated use itinerario */
  atrativos: ParadaItinerarioRow[]
}

async function assertPlacaVermelha(auth: Awaited<ReturnType<typeof assertUserSession>> & { ok: true }) {
  const prof = await buscarProfissionalPlacaVermelha(auth.supabase, auth.userId)
  if (!prof?.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a profissionais com placa vermelha.' }, { status: 403 })
  }
  return prof
}

async function montarManifestoRow(
  supabase: Awaited<ReturnType<typeof assertUserSession>> extends infer R
    ? R extends { ok: true; supabase: infer S }
      ? S
      : never
    : never,
  row: Record<string, unknown>,
  categorias: unknown,
): Promise<ManifestoDiarioRow> {
  const id = String(row.id)

  const [{ data: passageiros }, itinerario] = await Promise.all([
    supabase
      .from('manifesto_passageiros')
      .select(
        `
        id, ordem, turista_id, nome, nome_social, username, documento, data_nascimento, foto_url,
        contratacao_tipo, entrou_em, contratacao_validada_em, status, solicitacao_id,
        profissional_indireto:profissional_indireto_id (nome_completo)
      `,
      )
      .eq('manifesto_id', id)
      .order('ordem', { ascending: true }),
    listarParadasManifesto(supabase, id),
  ])

  const paradasPorTurista = new Map<string, number>()
  for (const p of itinerario) {
    if (!p.turista_id) continue
    paradasPorTurista.set(p.turista_id, (paradasPorTurista.get(p.turista_id) ?? 0) + 1)
  }

  return {
    id,
    data_manifesto: String(row.data_manifesto),
    status: String(row.status),
    criado_em: String(row.criado_em),
    confirmado_em: row.confirmado_em != null ? String(row.confirmado_em) : null,
    concluido_em: row.concluido_em != null ? String(row.concluido_em) : null,
    lista_iniciada_em: row.lista_iniciada_em != null ? String(row.lista_iniciada_em) : null,
    eh_guia: profissionalEhGuia(categorias),
    qtd_passageiros: passageiros?.length ?? 0,
    qtd_paradas: itinerario.length,
    passageiros: (passageiros ?? []).map((p, idx) => {
      const ind = joinSupabaseRow(p.profissional_indireto)
      const tid = p.turista_id != null ? String(p.turista_id) : null
      return {
        id: String(p.id),
        ordem: p.ordem != null ? Number(p.ordem) : idx + 1,
        turista_id: tid,
        nome: String(p.nome),
        nome_social: p.nome_social != null ? String(p.nome_social) : null,
        username: p.username != null ? String(p.username) : null,
        documento: p.documento != null ? String(p.documento) : null,
        data_nascimento: p.data_nascimento != null ? String(p.data_nascimento) : null,
        foto_url: p.foto_url != null ? String(p.foto_url) : null,
        contratacao_validada: p.contratacao_validada_em != null,
        contratacao_tipo: String(p.contratacao_tipo),
        contratacao_rotulo: rotuloContratacao(String(p.contratacao_tipo)),
        profissional_indireto_nome: ind?.nome_completo != null ? String(ind.nome_completo) : null,
        entrou_em: String(p.entrou_em),
        qtd_paradas: tid ? (paradasPorTurista.get(tid) ?? 0) : 0,
        status_fila:
          String(p.status) === 'recebido' || String(p.status) === 'cancelado'
            ? (String(p.status) as 'recebido' | 'cancelado')
            : 'pendente',
        solicitacao_id: p.solicitacao_id != null ? String(p.solicitacao_id) : null,
      }
    }),
    itinerario,
    atrativos: itinerario,
  }
}

/** Lista manifestos diários do profissional (placa vermelha). */
export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const profCheck = await assertPlacaVermelha(auth)
  if (profCheck instanceof NextResponse) return profCheck
  const profId = profCheck.id

  const url = new URL(req.url)
  const concluidos = url.searchParams.get('concluidos') === '1'

  let q = auth.supabase
    .from('manifesto_diario')
    .select('id, data_manifesto, status, criado_em, confirmado_em, concluido_em, lista_iniciada_em')
    .eq('profissional_id', profId)
    .order('data_manifesto', { ascending: false })
    .limit(50)

  if (concluidos) {
    q = q.eq('status', 'concluido')
  } else {
    q = q.neq('status', 'concluido').neq('status', 'cancelado')
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const manifestos: ManifestoDiarioRow[] = []
  for (const row of data ?? []) {
    manifestos.push(
      await montarManifestoRow(auth.supabase, row as Record<string, unknown>, profCheck.categorias),
    )
  }

  return NextResponse.json({ ok: true, manifestos })
}

/** Cria manifesto diário em rascunho. */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const profCheck = await assertPlacaVermelha(auth)
  if (profCheck instanceof NextResponse) return profCheck
  const profId = profCheck.id

  const body = (await req.json()) as Record<string, unknown>
  const dataManifesto = String(body.data_manifesto ?? new Date().toISOString().slice(0, 10))
  const turistaIds = Array.isArray(body.turista_ids) ? body.turista_ids.map(String) : []
  const paradasBody = Array.isArray(body.paradas) ? body.paradas : Array.isArray(body.atrativos) ? body.atrativos : []

  const { data: existente } = await auth.supabase
    .from('manifesto_diario')
    .select('id')
    .eq('profissional_id', profId)
    .eq('data_manifesto', dataManifesto)
    .not('status', 'in', '("cancelado","concluido")')
    .maybeSingle()

  if (existente?.id) {
    return NextResponse.json({ error: 'Já existe manifesto ativo para esta data.' }, { status: 400 })
  }

  const { data: novo, error: insErr } = await auth.supabase
    .from('manifesto_diario')
    .insert({
      profissional_id: profId,
      data_manifesto: dataManifesto,
      status: 'rascunho',
    })
    .select('id, data_manifesto, status, criado_em, confirmado_em, concluido_em')
    .maybeSingle()

  if (insErr || !novo) {
    return NextResponse.json({ error: insErr?.message ?? 'Erro ao criar manifesto.' }, { status: 500 })
  }

  const manifestoId = String(novo.id)

  for (const turistaId of turistaIds) {
    if (!turistaId) continue
    const { data: tur } = await auth.supabase
      .from('turistas')
      .select('nome_completo, nome_usuario, documento_identidade, foto_url, foto_perfil_url')
      .eq('usuario_id', turistaId)
      .maybeSingle()
    const un = tur?.nome_usuario != null ? String(tur.nome_usuario).replace(/^@+/, '') : ''
    await inserirPassageiroManifesto(auth.supabase, {
      manifestoId,
      turistaUsuarioId: turistaId,
      nome: String(tur?.nome_completo ?? 'Turista'),
      documento: tur?.documento_identidade != null ? String(tur.documento_identidade) : null,
      username: un ? `@${un}` : null,
      nome_social: un || null,
      foto_url:
        tur?.foto_perfil_url != null
          ? String(tur.foto_perfil_url)
          : tur?.foto_url != null
            ? String(tur.foto_url)
            : null,
      contratacaoTipo: 'contratacao_direta',
    })
  }

  for (const a of paradasBody) {
    if (typeof a !== 'object' || !a) continue
    const ab = a as Record<string, unknown>
    const empresaId = String(ab.empresa_id ?? '').trim()
    const turistaId = String(ab.turista_id ?? '').trim()
    if (!empresaId || !turistaId) continue
    await inserirParadasItinerario(auth.supabase, {
      manifestoId,
      turistaUsuarioId: turistaId,
      empresaIds: filtrarEmpresaIds([empresaId]),
    })
  }

  const manifesto = await montarManifestoRow(
    auth.supabase,
    novo as Record<string, unknown>,
    profCheck.categorias,
  )
  return NextResponse.json({ ok: true, manifesto })
}
