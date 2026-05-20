import { Building2, ShoppingBag, Star, Ticket, Utensils } from 'lucide-react'

/** Ordem e metadados das 4 categorias de comércio (alinhado a ListaCanaisProfissional). */
export const ORDEM_CATEGORIA_COMERCIO = ['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem']

/** @type {Record<string, string[]>} */
export const MATCH_CATEGORIA_COMERCIO = {
  Restaurantes: ['gastronomia', 'restaurantes'],
  Atrativos: ['passeios', 'atrativos'],
  Lojas: ['lojas'],
  Hospedagem: ['hospedagem'],
}

function IconHospedagemEstrela({ className, 'aria-hidden': ariaHidden = true }) {
  return (
    <Star
      className={className}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden={ariaHidden}
    />
  )
}
IconHospedagemEstrela.displayName = 'IconHospedagemEstrela'

export const ROTULO_CATEGORIA_COMERCIO = {
  Restaurantes: { Icon: Utensils, rotulo: 'Restaurantes' },
  Atrativos: { Icon: Ticket, rotulo: 'Atrativos' },
  Lojas: { Icon: ShoppingBag, rotulo: 'Lojas' },
  Hospedagem: { Icon: IconHospedagemEstrela, rotulo: 'Hospedagem' },
  Todas: { Icon: Building2, rotulo: 'Todas' },
}

/**
 * @param {string | null | undefined} categoria
 * @param {string} filtroChave Restaurantes | Atrativos | Lojas | Hospedagem | Todas
 */
export function categoriaCombinaChaveComercio(categoria, filtroChave) {
  if (filtroChave === 'Todas') return true
  const matches = MATCH_CATEGORIA_COMERCIO[filtroChave]
  if (!matches?.length) return true
  const norm = String(categoria ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return matches.some((m) => norm === m || norm.includes(m))
}
