import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import {
  buscarProfissionalPlacaVermelha,
  filtrarEmpresaIds,
  inserirAtrativosManifesto,
  inserirPassageiroManifesto,
  rotuloContratacao,
} from '@/lib/manifestoDiario'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

export type ManifestoPassageiroRow = {
  id: string
  turista_id: string | null
  nome: string
  username: string | null
  documento: string | null
  contratacao_tipo: string
  contratacao_rotulo: string
  profissional_indireto_nome: string | null
  entrou_em: string
}

export type ManifestoAtrativoRow = {
  id: string
  turista_id: string | null
  empresa_id: string
  empresa_nome: string
  categoria: string
  visitado: boolean
  visitado_em: string | null
  checkin_confirmado: boolean
}

export type ManifestoDiarioRow = {
  id: string
  data_manifesto: string
  status: string
  criado_em: string
  confirmado_em: string | null
  concluido_em: string | null
  qtd_passageiros: number
  qtd_atrativos: number
  passageiros: ManifestoPassageiroRow[]
  atrativos: ManifestoAtrativoRow[]
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
): Promise<ManifestoDiarioRow> {
  const id = String(row.id)

  const [{ data: passageiros }, { data: atrativos }, { data: checkins }] = await Promise.all([
    supabase
      .from('manifesto_passageiros')
      .select(
        `
        id, turista_id, nome, username, documento, contratacao_tipo, entrou_em,
        profissional_indireto:profissional_indireto_id (nome_completo)
      `,
      )
      .eq('manifesto_id', id)
      .order('entrou_em', { ascending: true }),
    supabase
      .from('manifesto_atrativos')
      .select(
        `
        id, turista_id, empresa_id, visitado, visitado_em,
        empresas:empresa_id (nome_fantasia, categoria)
      `,
      )
      .eq('manifesto_id', id)
      .order('selecionado_em', { ascending: true }),
    supabase
      .from('manifesto_checkins')
      .select('empresa_id, turista_id, status')
      .eq('manifesto_id', id)
      .eq('status', 'confirmado'),
  ])

  const checkinSet = new Set(
    (checkins ?? []).map((c) => `${String(c.empresa_id)}:${String(c.turista_id ?? '')}`),
  )

  return {
    id,
    data_manifesto: String(row.data_manifesto),
    status: String(row.status),
    criado_em: String(row.criado_em),
    confirmado_em: row.confirmado_em != null ? String(row.confirmado_em) : null,
    concluido_em: row.concluido_em != null ? String(row.concluido_em) : null,
    qtd_passageiros: passageiros?.length ?? 0,
    qtd_atrativos: atrativos?.length ?? 0,
    passageiros: (passageiros ?? []).map((p) => {
      const ind = joinSupabaseRow(p.profissional_indireto)
      return {
        id: String(p.id),
        turista_id: p.turista_id != null ? String(p.turista_id) : null,
        nome: String(p.nome),
        username: p.username != null ? String(p.username) : null,
        documento: p.documento != null ? String(p.documento) : null,
        contratacao_tipo: String(p.contratacao_tipo),
        contratacao_rotulo: rotuloContratacao(String(p.contratacao_tipo)),
        profissional_indireto_nome: ind?.nome_completo != null ? String(ind.nome_completo) : null,
        entrou_em: String(p.entrou_em),
      }
    }),
    atrativos: (atrativos ?? []).map((a) => {
      const emp = joinSupabaseRow(a.empresas)
      const key = `${String(a.empresa_id)}:${String(a.turista_id ?? '')}`
      return {
        id: String(a.id),
        turista_id: a.turista_id != null ? String(a.turista_id) : null,
        empresa_id: String(a.empresa_id),
        empresa_nome: String(emp?.nome_fantasia ?? 'Empresa'),
        categoria: String(emp?.categoria ?? ''),
        visitado: Boolean(a.visitado),
        visitado_em: a.visitado_em != null ? String(a.visitado_em) : null,
        checkin_confirmado: checkinSet.has(key),
      }
    }),
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
    .select('id, data_manifesto, status, criado_em, confirmado_em, concluido_em')
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
    manifestos.push(await montarManifestoRow(auth.supabase, row as Record<string, unknown>))
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
  const passageirosBody = Array.isArray(body.passageiros) ? body.passageiros : []
  const atrativosBody = Array.isArray(body.atrativos) ? body.atrativos : []

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

  for (const p of passageirosBody) {
    if (typeof p !== 'object' || !p) continue
    const pb = p as Record<string, unknown>
    const turistaId = String(pb.turista_id ?? '').trim()
    if (!turistaId) continue

    let nome = String(pb.nome ?? 'Turista')
    let documento = pb.documento != null ? String(pb.documento) : null
    let username = pb.username != null ? String(pb.username) : null

    if (!pb.nome) {
      const { data: tur } = await auth.supabase
        .from('turistas')
        .select('nome_completo, nome_usuario, documento_identidade')
        .eq('usuario_id', turistaId)
        .maybeSingle()
      if (tur) {
        nome = String(tur.nome_completo ?? nome)
        documento = tur.documento_identidade != null ? String(tur.documento_identidade) : null
        const un = tur.nome_usuario != null ? String(tur.nome_usuario).replace(/^@+/, '') : ''
        username = un ? `@${un}` : null
      }
    }

    await inserirPassageiroManifesto(auth.supabase, {
      manifestoId,
      turistaUsuarioId: turistaId,
      nome,
      documento,
      username,
      contratacaoTipo: String(pb.contratacao_tipo ?? 'contratacao_direta') as 'indicacao',
    })
  }

  for (const turistaId of turistaIds) {
    if (!turistaId) continue
    const { data: tur } = await auth.supabase
      .from('turistas')
      .select('nome_completo, nome_usuario, documento_identidade')
      .eq('usuario_id', turistaId)
      .maybeSingle()
    const un = tur?.nome_usuario != null ? String(tur.nome_usuario).replace(/^@+/, '') : ''
    await inserirPassageiroManifesto(auth.supabase, {
      manifestoId,
      turistaUsuarioId: turistaId,
      nome: String(tur?.nome_completo ?? 'Turista'),
      documento: tur?.documento_identidade != null ? String(tur.documento_identidade) : null,
      username: un ? `@${un}` : null,
      contratacaoTipo: 'contratacao_direta',
    })
  }

  for (const a of atrativosBody) {
    if (typeof a !== 'object' || !a) continue
    const ab = a as Record<string, unknown>
    const empresaId = String(ab.empresa_id ?? '').trim()
    const turistaId = String(ab.turista_id ?? '').trim()
    if (!empresaId) continue
    await inserirAtrativosManifesto(auth.supabase, {
      manifestoId,
      turistaUsuarioId: turistaId,
      empresaIds: filtrarEmpresaIds([empresaId]),
    })
  }

  const manifesto = await montarManifestoRow(auth.supabase, novo as Record<string, unknown>)
  return NextResponse.json({ ok: true, manifesto })
}
