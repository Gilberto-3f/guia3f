import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'
import { bandeiraProfissionalRegistro } from '@/lib/bandeiraProfissional'

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
}

/** GET ?q= — busca profissionais do ecossistema (exceto o próprio). */
export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const q = String(new URL(req.url).searchParams.get('q') ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[%_,()]/g, '')

  if (q.length < 2) {
    return NextResponse.json({ ok: true, profissionais: [] as ProfissionalEcossistemaRow[] })
  }

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

  const pattern = `%${q}%`
  const cols =
    'id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, placa_vermelha, pais, cidade_atuacao, status'

  const [porUser, porNome] = await Promise.all([
    admin.from('profissionais').select(cols).ilike('nome_usuario', pattern).limit(20),
    admin.from('profissionais').select(cols).ilike('nome_completo', pattern).limit(20),
  ])

  if (porUser.error || porNome.error) {
    return NextResponse.json(
      { error: porUser.error?.message ?? porNome.error?.message ?? 'Falha na busca.' },
      { status: 500 },
    )
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
  }

  const map = new Map<string, Row>()
  for (const row of [...(porUser.data ?? []), ...(porNome.data ?? [])] as Row[]) {
    const id = String(row.id)
    if (id === String(eu.id)) continue
    if (!map.has(id)) map.set(id, row)
  }

  const rows = [...map.values()].slice(0, 15)
  const usuarioIds = rows.map((r) => String(r.usuario_id)).filter(Boolean)
  const profIds = rows.map((r) => String(r.id))

  const notaMap = new Map<string, { soma: number; n: number }>()
  if (usuarioIds.length > 0) {
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
  }

  const profissionais: ProfissionalEcossistemaRow[] = rows.map((r) => {
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
      categorias: normalizarCategoriasProfissional(r.categorias),
      placa_vermelha: Boolean(r.placa_vermelha),
      nota_media: n > 0 ? Math.round((soma / n) * 10) / 10 : null,
      total_avaliacoes: n,
      pais_bandeira: bandeiraProfissionalRegistro({
        pais: r.pais,
        cidadeAtuacao: r.cidade_atuacao,
      }),
    }
  })

  return NextResponse.json({ ok: true, profissionais })
}
