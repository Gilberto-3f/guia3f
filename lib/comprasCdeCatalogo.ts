/** Catálogo Compras CDE — constantes, tipos e helpers de preço. */

export const COR_AZUL_LOGO = '#0097b2'
export const COR_VERDE_BOTAO = '#00D443'

export const FOTOS_MIN = 1
export const FOTOS_MAX = 3
export const DESCRICAO_MAX = 1200
export const NOME_PRODUTO_MAX = 25

export const CATEGORIAS_PRODUTO_FIXAS = [
  { slug: 'smartphones', nome: 'Smartphones' },
  { slug: 'eletrodomesticos', nome: 'Eletrodomésticos' },
  { slug: 'eletronicos', nome: 'Eletrônicos' },
  { slug: 'perfumaria-cosmeticos', nome: 'Perfumaria e Cosméticos' },
  { slug: 'bebidas-alimentos', nome: 'Bebidas e Alimentos' },
  { slug: 'vestuario-calcados', nome: 'Vestuário e Calçados' },
  { slug: 'brinquedos', nome: 'Brinquedos e Colecionáveis' },
  { slug: 'artigos-automotivo', nome: 'Artigos Automotivo' },
  { slug: 'artigos-esportivos', nome: 'Artigos esportivos' },
  { slug: 'ferramentas', nome: 'Ferramentas' },
  { slug: 'produtos-farmaceuticos', nome: 'Farmácia e Suplementos' },
  { slug: 'departamento-geral', nome: 'Departamento / Geral' },
] as const

export type CategoriaProdutoSlug = (typeof CATEGORIAS_PRODUTO_FIXAS)[number]['slug']

export type ProdutoCategoriaRow = {
  id: string
  slug: string
  nome: string
  ordem: number
}

export type ProdutoCdeRow = {
  id: string
  empresa_id: string
  nome: string
  descricao: string | null
  preco_usd: number
  percentual_desconto: number
  fotos: string[]
  foto_url: string | null
  site_url: string | null
  ativo: boolean
  categoria_id: string | null
  subcategoria_id: string | null
  marca_id: string | null
  palavras_chave: string[]
  categoria_nome?: string | null
  categoria_ordem?: number
  subcategoria_nome?: string | null
  marca_nome?: string | null
  created_at?: string
}

/** Normaliza texto para agrupamento (trim, minúsculas, sem acento). */
export function normalizarTextoTaxonomia(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function precoFinalUsd(precoUsd: number, percentualDesconto: number): number {
  const p = Math.max(0, Number(precoUsd) || 0)
  const d = Math.min(100, Math.max(0, Number(percentualDesconto) || 0))
  return Math.round(p * (1 - d / 100) * 100) / 100
}

export function formatarUsd(valor: number): string {
  return `US$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Cotação: quantidade da moeda estrangeira por 1 BRL → BRL = usd / taxa. */
export function usdParaBrl(usd: number, taxaUsdPorBrl: number): number {
  const u = Math.max(0, Number(usd) || 0)
  const t = Number(taxaUsdPorBrl) || 0
  if (t <= 0) return 0
  return Math.round((u / t) * 100) / 100
}

export function formatarBrl(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}


export function montarPalavrasChave(opts: {
  nome: string
  categoriaNome: string
  subcategoriaNome: string
  marcaNome: string
}): string[] {
  const parts = [opts.nome, opts.categoriaNome, opts.subcategoriaNome, opts.marcaNome]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const n = normalizarTextoTaxonomia(p)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(p)
  }
  return out
}

export function mapProdutoRow(raw: Record<string, unknown>): ProdutoCdeRow {
  const fotosRaw = raw.fotos
  let fotos: string[] = []
  if (Array.isArray(fotosRaw)) {
    fotos = fotosRaw.map(String).filter((u) => u.trim())
  }
  const fotoUrl = raw.foto_url != null ? String(raw.foto_url) : null
  if (!fotos.length && fotoUrl) fotos = [fotoUrl]

  const cat = raw.produto_categorias
  const sub = raw.produto_subcategorias
  const marca = raw.produto_marcas

  return {
    id: String(raw.id),
    empresa_id: String(raw.empresa_id),
    nome: String(raw.nome ?? ''),
    descricao: raw.descricao != null ? String(raw.descricao) : null,
    preco_usd: Number(raw.preco_usd) || 0,
    percentual_desconto: Number(raw.percentual_desconto) || 0,
    fotos,
    foto_url: fotoUrl,
    site_url: raw.site_url != null ? String(raw.site_url) : null,
    ativo: raw.ativo !== false,
    categoria_id: raw.categoria_id != null ? String(raw.categoria_id) : null,
    subcategoria_id: raw.subcategoria_id != null ? String(raw.subcategoria_id) : null,
    marca_id: raw.marca_id != null ? String(raw.marca_id) : null,
    palavras_chave: Array.isArray(raw.palavras_chave)
      ? raw.palavras_chave.map(String)
      : [],
    categoria_nome:
      cat && typeof cat === 'object' && !Array.isArray(cat) && (cat as { nome?: unknown }).nome != null
        ? String((cat as { nome: unknown }).nome)
        : null,
    categoria_ordem:
      cat && typeof cat === 'object' && !Array.isArray(cat) && (cat as { ordem?: unknown }).ordem != null
        ? Number((cat as { ordem: unknown }).ordem)
        : 999,
    subcategoria_nome:
      sub && typeof sub === 'object' && !Array.isArray(sub) && (sub as { nome?: unknown }).nome != null
        ? String((sub as { nome: unknown }).nome)
        : null,
    marca_nome:
      marca && typeof marca === 'object' && !Array.isArray(marca) && (marca as { nome?: unknown }).nome !=
      null
        ? String((marca as { nome: unknown }).nome)
        : null,
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
  }
}
