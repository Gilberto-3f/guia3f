import { NextResponse } from 'next/server'
import { assertAdminSession, jsonAdminError, loadAdminUsuarioRow } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  cidadeDoCatalogo,
  mapRowEcossistema,
  normalizarCidadeChave,
  slugDeNome,
  type EcossistemaCidade,
  type EcossistemaTileSexto,
  type EcossistemaTipo,
} from '@/lib/ecossistemas'

function podeGerir(adminRow: { admin_level?: number | null; admin_permissoes?: unknown } | null) {
  const nivel = Number(adminRow?.admin_level ?? 0)
  const cargo = (adminRow?.admin_permissoes as { cargo?: string } | null)?.cargo
  return nivel === 1 || cargo === 'FINANCEIRO'
}

async function requireAdmGeralOuFinanceiro() {
  const auth = await assertAdminSession()
  if (!auth.ok) return { ok: false as const, error: auth.error }
  const { row } = await loadAdminUsuarioRow(auth.userId, auth.email)
  if (!podeGerir(row)) {
    return { ok: false as const, error: jsonAdminError(403, 'forbidden', 'Sem permissão para ecossistemas.') }
  }
  let adminDb
  try {
    adminDb = createSupabaseAdmin()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'service_role_unavailable'
    return { ok: false as const, error: jsonAdminError(503, 'admin_db', msg) }
  }
  return { ok: true as const, adminDb }
}

function parseCidades(raw: unknown): EcossistemaCidade[] {
  if (!Array.isArray(raw)) return []
  const out: EcossistemaCidade[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const texto =
      typeof item === 'string'
        ? item
        : item && typeof item === 'object'
          ? String((item as { chave?: string; label?: string }).chave ?? (item as { label?: string }).label ?? '')
          : ''
    const cat = cidadeDoCatalogo(texto)
    const chave = cat?.chave ?? normalizarCidadeChave(texto)
    if (!chave) continue
    const key = chave.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const label =
      cat?.label ??
      (typeof item === 'object' && item && 'label' in item
        ? String((item as { label?: string }).label ?? chave)
        : chave)
    const pais =
      cat?.pais ??
      (typeof item === 'object' && item && 'pais' in item
        ? String((item as { pais?: string }).pais ?? '') || null
        : null)
    out.push({ chave, label, pais })
  }
  return out
}

function parseTipo(raw: unknown): EcossistemaTipo {
  return String(raw) === 'regiao' ? 'regiao' : 'cidade'
}

function parseTile(raw: unknown): EcossistemaTileSexto {
  const t = String(raw ?? 'aguarde')
  if (t === 'compras_cde' || t === 'servicos_locais') return t
  return 'aguarde'
}

async function montarLista(adminDb: ReturnType<typeof createSupabaseAdmin>) {
  const { data: ecos, error } = await adminDb
    .from('ecossistemas')
    .select('*')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })
  if (error) throw error
  const { data: cidades } = await adminDb.from('ecossistema_cidades').select('*')
  const porEco = new Map<string, EcossistemaCidade[]>()
  for (const c of cidades ?? []) {
    const id = String(c.ecossistema_id)
    const lista = porEco.get(id) ?? []
    lista.push({
      chave: String(c.cidade_chave),
      label: String(c.cidade_label ?? c.cidade_chave),
      pais: c.pais != null ? String(c.pais) : null,
    })
    porEco.set(id, lista)
  }
  return (ecos ?? []).map((row) =>
    mapRowEcossistema(row as Record<string, unknown>, porEco.get(String(row.id)) ?? []),
  )
}

export async function GET() {
  try {
    const gate = await requireAdmGeralOuFinanceiro()
    if (!gate.ok) return gate.error
    const lista = await montarLista(gate.adminDb)
    return NextResponse.json({ ok: true, ecossistemas: lista })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'list', msg)
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireAdmGeralOuFinanceiro()
    if (!gate.ok) return gate.error

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return jsonAdminError(400, 'json', 'JSON inválido.')
    }

    const nome = String(body.nome ?? '').trim()
    if (nome.length < 2) return jsonAdminError(400, 'nome', 'Informe o nome do ecossistema.')
    const tipo = parseTipo(body.tipo)
    const cidades = parseCidades(body.cidades)
    if (cidades.length < 1) {
      return jsonAdminError(400, 'cidades', 'Inclua ao menos uma cidade.')
    }
    if (tipo === 'cidade' && cidades.length > 1) {
      return jsonAdminError(400, 'cidades', 'Ecossistema do tipo cidade aceita só um município.')
    }

    let slug = slugDeNome(String(body.slug ?? nome))
    if (!slug) slug = `eco-${Date.now()}`
    const tile_sexto = parseTile(body.tile_sexto)
    const disponivel_home = body.disponivel_home !== false
    const padrao = body.padrao === true
    const descricao = String(body.descricao ?? '').trim() || null
    const ordem = Number.isFinite(Number(body.ordem)) ? Number(body.ordem) : 99

    if (padrao) {
      await gate.adminDb.from('ecossistemas').update({ padrao: false }).eq('padrao', true)
    }

    const { data: novo, error: insErr } = await gate.adminDb
      .from('ecossistemas')
      .insert({
        slug,
        nome,
        tipo,
        descricao,
        disponivel_home,
        padrao,
        tile_sexto,
        ordem,
      })
      .select('*')
      .maybeSingle()
    if (insErr || !novo?.id) {
      const msg = insErr?.message ?? 'Não foi possível criar.'
      if (msg.toLowerCase().includes('duplicate') || msg.includes('23505')) {
        return jsonAdminError(400, 'slug', 'Já existe um ecossistema com esse identificador.')
      }
      return jsonAdminError(400, 'insert', msg)
    }

    const { error: cidErr } = await gate.adminDb.from('ecossistema_cidades').insert(
      cidades.map((c) => ({
        ecossistema_id: novo.id,
        cidade_chave: c.chave,
        cidade_label: c.label,
        pais: c.pais,
      })),
    )
    if (cidErr) {
      await gate.adminDb.from('ecossistemas').delete().eq('id', novo.id)
      return jsonAdminError(400, 'cidades', cidErr.message)
    }

    const lista = await montarLista(gate.adminDb)
    const criado = lista.find((e) => e.id === String(novo.id)) ?? null
    return NextResponse.json({ ok: true, ecossistema: criado, ecossistemas: lista })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return jsonAdminError(500, 'create', msg)
  }
}
