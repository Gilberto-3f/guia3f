import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'
import { bandeiraProfissionalRegistro } from '@/lib/bandeiraProfissional'
import { profissionalElegivelBuscaEcossistema } from '@/lib/mobilidadeStatusProfissional'

export type ProfissionalEcossistemaRow = {
  id: string
  usuario_id: string
  nome: string
  username: string | null
  foto_url: string | null
  categorias: string[]
  placa_vermelha: boolean
  nota_media: number | null
  total_avaliacoes: number
  pais_bandeira: string | null
  /** Distância km (só no modo online/algoritmo). */
  distancia_km?: number | null
  online?: boolean
}

type Row = {
  id: string
  usuario_id: string
  nome_completo: string | null
  nome_usuario: string | null
  foto_perfil_url: string | null
  foto_url: string | null
  categorias: unknown
  placa_vermelha: boolean | null
  pais: string | null
  cidade_atuacao: unknown
  status: string | null
  mobilidade_status?: string | null
  mobilidade_lat?: number | null
  mobilidade_lng?: number | null
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h =
    s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

async function montarNotas(admin: SupabaseClient, rows: Row[]) {
  const usuarioIds = rows.map((r) => String(r.usuario_id)).filter(Boolean)
  const profIds = rows.map((r) => String(r.id))
  const notaMap = new Map<string, { soma: number; n: number }>()
  if (usuarioIds.length === 0) return notaMap
  const alvoIds = [...new Set([...usuarioIds, ...profIds])]
  const { data: avs } = await admin
    .from('avaliacoes')
    .select('alvo_id, nota')
    .eq('alvo_tipo', 'profissional')
    .in('alvo_id', alvoIds)
  for (const a of avs ?? []) {
    const aid = String(a.alvo_id)
    const nota = Number(a.nota)
    if (!Number.isFinite(nota)) continue
    const cur = notaMap.get(aid) ?? { soma: 0, n: 0 }
    cur.soma += nota
    cur.n += 1
    notaMap.set(aid, cur)
  }
  return notaMap
}

function rowParaEcossistema(
  r: Row,
  notaMap: Map<string, { soma: number; n: number }>,
  extra?: { distancia_km?: number | null; online?: boolean },
): ProfissionalEcossistemaRow {
  const uid = String(r.usuario_id)
  const pid = String(r.id)
  const porUid = notaMap.get(uid)
  const porPid = notaMap.get(pid)
  const soma = (porUid?.soma ?? 0) + (porPid?.soma ?? 0)
  const n = (porUid?.n ?? 0) + (porPid?.n ?? 0)
  const foto =
    r.foto_perfil_url != null && String(r.foto_perfil_url).trim()
      ? String(r.foto_perfil_url)
      : r.foto_url != null && String(r.foto_url).trim()
        ? String(r.foto_url)
        : null
  return {
    id: pid,
    usuario_id: uid,
    nome: String(r.nome_completo ?? 'Profissional'),
    username: r.nome_usuario != null ? String(r.nome_usuario).replace(/^@+/, '') : null,
    foto_url: foto,
    categorias: normalizarCategoriasProfissional(
      Array.isArray(r.categorias) ? r.categorias.map(String) : null,
    ),
    placa_vermelha: Boolean(r.placa_vermelha),
    nota_media: n > 0 ? Math.round((soma / n) * 10) / 10 : null,
    total_avaliacoes: n,
    pais_bandeira: bandeiraProfissionalRegistro({
      pais: r.pais != null ? String(r.pais) : null,
      cidadeAtuacao: Array.isArray(r.cidade_atuacao)
        ? r.cidade_atuacao.map(String)
        : r.cidade_atuacao != null
          ? String(r.cidade_atuacao)
          : null,
    }),
    distancia_km: extra?.distancia_km ?? null,
    online: extra?.online,
  }
}

/**
 * GET ?q= — busca manual por nome/@ (só mobilidade).
 * GET ?modo=online&lat=&lng= — algoritmo: profissionais online agora, ordenados por proximidade.
 */
export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const modo = String(url.searchParams.get('modo') ?? '').trim()
  const q = String(url.searchParams.get('q') ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[%_,()]/g, '')

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: eu } = await admin
    .from('profissionais')
    .select('id')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!eu?.id) {
    return NextResponse.json({ error: 'Acesso restrito a profissionais.' }, { status: 403 })
  }

  const euId = String(eu.id)

  /** Modo algoritmo: online agora. */
  if (modo === 'online') {
    const lat = Number(url.searchParams.get('lat'))
    const lng = Number(url.searchParams.get('lng'))
    const temGps = Number.isFinite(lat) && Number.isFinite(lng)

    const { data, error } = await admin
      .from('profissionais')
      .select(
        'id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, placa_vermelha, pais, cidade_atuacao, status, mobilidade_status, mobilidade_lat, mobilidade_lng',
      )
      .eq('mobilidade_status', 'online')
      .limit(60)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const filtrados = ((data ?? []) as Row[]).filter((r) => {
      if (String(r.id) === euId) return false
      const cats = normalizarCategoriasProfissional(
        Array.isArray(r.categorias) ? r.categorias.map(String) : null,
      )
      return profissionalElegivelBuscaEcossistema(cats)
    })

    const scored = filtrados.map((r) => {
      const pLat = Number(r.mobilidade_lat)
      const pLng = Number(r.mobilidade_lng)
      const dist =
        temGps && Number.isFinite(pLat) && Number.isFinite(pLng)
          ? haversineKm(lat, lng, pLat, pLng)
          : null
      return { row: r, dist }
    })
    scored.sort((a, b) => {
      if (a.dist == null && b.dist == null) return 0
      if (a.dist == null) return 1
      if (b.dist == null) return -1
      return a.dist - b.dist
    })

    const top = scored.slice(0, 20)
    const notaMap = await montarNotas(
      admin,
      top.map((s) => s.row),
    )
    const profissionais = top.map((s) =>
      rowParaEcossistema(s.row, notaMap, {
        distancia_km: s.dist != null ? Math.round(s.dist * 10) / 10 : null,
        online: true,
      }),
    )

    return NextResponse.json({ ok: true, modo: 'online', profissionais })
  }

  /** Busca manual. */
  if (q.length < 2) {
    return NextResponse.json({ ok: true, profissionais: [] as ProfissionalEcossistemaRow[] })
  }

  const pattern = `%${q}%`
  const cols =
    'id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, placa_vermelha, pais, cidade_atuacao, status'

  const [porUser, porNome] = await Promise.all([
    admin.from('profissionais').select(cols).ilike('nome_usuario', pattern).limit(30),
    admin.from('profissionais').select(cols).ilike('nome_completo', pattern).limit(30),
  ])

  if (porUser.error || porNome.error) {
    return NextResponse.json(
      { error: porUser.error?.message ?? porNome.error?.message ?? 'Falha na busca.' },
      { status: 500 },
    )
  }

  const map = new Map<string, Row>()
  for (const row of [...(porUser.data ?? []), ...(porNome.data ?? [])] as Row[]) {
    const id = String(row.id)
    if (id === euId) continue
    const cats = normalizarCategoriasProfissional(
      Array.isArray(row.categorias) ? row.categorias.map(String) : null,
    )
    if (!profissionalElegivelBuscaEcossistema(cats)) continue
    if (!map.has(id)) map.set(id, row)
  }

  const rows = [...map.values()].slice(0, 15)
  const notaMap = await montarNotas(admin, rows)
  const profissionais = rows.map((r) => rowParaEcossistema(r, notaMap))

  return NextResponse.json({ ok: true, profissionais })
}
