import { categoriaProfissionalParaSlug } from '@/lib/canaisProfissionalSlugs'

/** @param {unknown} v */
function asCategorias(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean)
    } catch {
      // ignore
    }
  }
  return []
}

const ROTULO_POR_SLUG = {
  guia: 'guia de turismo',
  motorista_app: 'motorista de app',
  van: 'motorista de van',
  taxista: 'taxista',
  anfitriao: 'anfitrião',
}

/**
 * Rótulo legível da categoria principal do profissional (mensagem de recomendação).
 * @param {unknown} categorias
 */
export function rotuloCategoriaProfissionalMensagem(categorias) {
  const lista = asCategorias(categorias)
  if (lista.length === 0) return 'profissional'

  const raw = lista[0]
  const slug = categoriaProfissionalParaSlug(raw)
  if (slug && ROTULO_POR_SLUG[slug]) return ROTULO_POR_SLUG[slug]

  return String(raw)
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim()
}
