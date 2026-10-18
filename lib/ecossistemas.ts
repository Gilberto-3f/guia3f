export type EcossistemaTipo = 'cidade' | 'regiao'

export type EcossistemaTileSexto = 'aguarde' | 'compras_cde' | 'servicos_locais'

export type EcossistemaCidade = {
  chave: string
  label: string
  pais: string | null
}

export type EcossistemaBloco = {
  id: string
  slug: string
  nome: string
  tipo: EcossistemaTipo
  descricao: string | null
  disponivel_home: boolean
  padrao: boolean
  tile_sexto: EcossistemaTileSexto
  ordem: number
  cidades: EcossistemaCidade[]
}

/** Cidades conhecidas (cadastro + seed). ADM pode acrescentar outras no formulário. */
export const CIDADES_CATALOGO: EcossistemaCidade[] = [
  { chave: 'Foz do Iguacu', label: 'Foz do Iguaçu', pais: 'BR' },
  { chave: 'Ciudad del Este', label: 'Ciudad del Este', pais: 'PY' },
  { chave: 'Puerto Iguazu', label: 'Puerto Iguazú', pais: 'AR' },
  { chave: 'Londrina', label: 'Londrina', pais: 'BR' },
]

export const TILE_SEXTO_OPCOES: { id: EcossistemaTileSexto; label: string }[] = [
  { id: 'aguarde', label: 'Aguarde (sem página)' },
  { id: 'compras_cde', label: 'Compras CDE (comparador)' },
  { id: 'servicos_locais', label: 'Serviços locais' },
]

export function slugDeNome(nome: string): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function normalizarCidadeChave(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cidadeDoCatalogo(chaveOuLabel: string): EcossistemaCidade | null {
  const n = normalizarCidadeChave(chaveOuLabel).toLowerCase()
  if (!n) return null
  return (
    CIDADES_CATALOGO.find(
      (c) =>
        normalizarCidadeChave(c.chave).toLowerCase() === n ||
        normalizarCidadeChave(c.label).toLowerCase() === n,
    ) ?? null
  )
}

export function parseEcossistemaIds(raw: unknown): string[] {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const out: string[] = []
  const seen = new Set<string>()
  const push = (v: unknown) => {
    const id = String(v ?? '').trim()
    if (!uuid.test(id) || seen.has(id)) return
    seen.add(id)
    out.push(id)
  }
  if (Array.isArray(raw)) {
    for (const item of raw) push(item)
    return out
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return parseEcossistemaIds(parsed)
    } catch {
      /* csv */
    }
    for (const part of raw.split(',')) push(part)
  }
  return out
}

export function cidadesChaveDosBlocos(blocos: EcossistemaBloco[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const b of blocos) {
    for (const c of b.cidades) {
      const chave = String(c.chave ?? '').trim()
      if (!chave) continue
      const k = chave.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(chave)
    }
  }
  return out
}

export async function listarEcossistemasDb(db: { from: (table: string) => any }): Promise<EcossistemaBloco[]> {
  const { data: ecos, error } = await db
    .from('ecossistemas')
    .select('*')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  const { data: cidades } = await db.from('ecossistema_cidades').select('*')
  const porEco = new Map<string, EcossistemaCidade[]>()
  for (const c of (cidades as Record<string, unknown>[] | null) ?? []) {
    const id = String(c.ecossistema_id)
    const lista = porEco.get(id) ?? []
    lista.push({
      chave: String(c.cidade_chave),
      label: String(c.cidade_label ?? c.cidade_chave),
      pais: c.pais != null ? String(c.pais) : null,
    })
    porEco.set(id, lista)
  }
  return ((ecos as Record<string, unknown>[] | null) ?? []).map((row) =>
    mapRowEcossistema(row, porEco.get(String(row.id)) ?? []),
  )
}

export function tabelaVinculoEcossistema(tipo: 'empresa' | 'profissional'): {
  table: 'empresa_ecossistemas' | 'profissional_ecossistemas'
  fk: 'empresa_id' | 'profissional_id'
} {
  return tipo === 'empresa'
    ? { table: 'empresa_ecossistemas', fk: 'empresa_id' }
    : { table: 'profissional_ecossistemas', fk: 'profissional_id' }
}

export function vinculoEcossistemaIgnoravel(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  const msg = String(error.message ?? '').toLowerCase()
  const code = String(error.code ?? '')
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (msg.includes('does not exist') && (msg.includes('ecossistema') || msg.includes('schema cache')))
  )
}

export async function resolverIdsEcossistema(
  db: { from: (table: string) => any },
  idsInformados: string[],
): Promise<{ ids: string[]; blocos: EcossistemaBloco[] }> {
  const todos = await listarEcossistemasDb(db)
  if (todos.length === 0) return { ids: [], blocos: [] }
  const porId = new Map(todos.map((e) => [e.id, e]))
  const escolhidos = idsInformados.map((id) => porId.get(id)).filter((e): e is EcossistemaBloco => Boolean(e))
  if (escolhidos.length > 0) {
    return { ids: escolhidos.map((e) => e.id), blocos: escolhidos }
  }
  const padrao = todos.find((e) => e.padrao) ?? todos[0]
  return { ids: [padrao.id], blocos: [padrao] }
}

export async function gravarVinculosEcossistema(
  db: { from: (table: string) => any },
  tipo: 'empresa' | 'profissional',
  perfilId: string,
  ecoIds: string[],
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!perfilId || ecoIds.length < 1) return { ok: true, skipped: true }
  const { table, fk } = tabelaVinculoEcossistema(tipo)
  const del = await db.from(table).delete().eq(fk, perfilId)
  if (del.error && !vinculoEcossistemaIgnoravel(del.error)) {
    return { ok: false, error: del.error.message }
  }
  if (del.error && vinculoEcossistemaIgnoravel(del.error)) {
    return { ok: true, skipped: true }
  }
  const ins = await db.from(table).insert(ecoIds.map((id) => ({ [fk]: perfilId, ecossistema_id: id })))
  if (ins.error && vinculoEcossistemaIgnoravel(ins.error)) {
    return { ok: true, skipped: true }
  }
  if (ins.error) return { ok: false, error: ins.error.message }
  return { ok: true }
}

export function mapRowEcossistema(
  row: Record<string, unknown>,
  cidades: EcossistemaCidade[] = [],
): EcossistemaBloco {
  const tipo = String(row.tipo ?? 'cidade') === 'regiao' ? 'regiao' : 'cidade'
  const tile = String(row.tile_sexto ?? 'aguarde')
  const tile_sexto: EcossistemaTileSexto =
    tile === 'compras_cde' || tile === 'servicos_locais' ? tile : 'aguarde'
  return {
    id: String(row.id),
    slug: String(row.slug ?? ''),
    nome: String(row.nome ?? ''),
    tipo,
    descricao: row.descricao != null ? String(row.descricao) : null,
    disponivel_home: row.disponivel_home !== false,
    padrao: row.padrao === true,
    tile_sexto,
    ordem: Number(row.ordem ?? 0),
    cidades,
  }
}

export function blocosDisponiveisHome(lista: EcossistemaBloco[]): EcossistemaBloco[] {
  return lista.filter((e) => e.disponivel_home)
}

export function escolherBlocoInicial(
  lista: EcossistemaBloco[],
  storedId: string | null,
): EcossistemaBloco | null {
  const home = blocosDisponiveisHome(lista)
  if (home.length === 0) return null
  if (storedId) {
    const hit = home.find((e) => e.id === storedId)
    if (hit) return hit
  }
  return home.find((e) => e.padrao) ?? home[0] ?? null
}

export function podeEscolherEcossistemaHome(role: string | null | undefined): boolean {
  const r = String(role ?? '').trim()
  return r !== 'profissional' && r !== 'empresa'
}
