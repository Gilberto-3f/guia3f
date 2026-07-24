import type { LucideIcon } from 'lucide-react'
import { Calendar, Car, Hotel, Package, ShoppingBag, Ticket, Utensils, Wrench } from 'lucide-react'

export const ROTULO_ABA_SERVICO: Record<string, string> = {
  gastronomia: 'Cardápio',
  Restaurantes: 'Cardápio',
  passeios: 'Tickets',
  Atrativos: 'Tickets',
  lojas: 'Produtos',
  Lojas: 'Produtos',
  hospedagem: 'Reservar',
  Hospedagem: 'Reservar',
  servicos_locais: 'Serviços',
  'Serviços Locais': 'Serviços',
  'Compras Paraguai': 'Ofertas',
  eventos: 'Ingressos',
  Eventos: 'Ingressos',
  mobilidade: 'Serviços',
  Mobilidade: 'Serviços',
}

/** Alinhado a `botoesPorCategoria` em `AbaBotaoDinamico` (ícone do canal / botão profissional). */
const ICONE_BA_SERVICO: Record<string, LucideIcon> = {
  gastronomia: Utensils,
  Restaurantes: Utensils,
  passeios: Ticket,
  Atrativos: Ticket,
  lojas: ShoppingBag,
  Lojas: ShoppingBag,
  hospedagem: Hotel,
  Hospedagem: Hotel,
  servicos_locais: Wrench,
  'Serviços Locais': Wrench,
  'Compras Paraguai': ShoppingBag,
  eventos: Calendar,
  Eventos: Calendar,
  mobilidade: Car,
  Mobilidade: Car,
}

export function getRotuloAbaServico(categoria: string) {
  return ROTULO_ABA_SERVICO[categoria] || 'Serviços'
}

export function getIconeAbaServico(categoria: string): LucideIcon {
  return ICONE_BA_SERVICO[categoria] ?? Package
}

/** Empresa de gastronomia (cardápio digital) — alinhado a `isGastronomia` em BotaoDinamico/AbaBotaoDinamico. */
export function empresaEhGastronomia(categoria: string | null | undefined): boolean {
  const c = String(categoria ?? '').toLowerCase().trim()
  return c === 'restaurantes' || c === 'gastronomia'
}

/** Empresa de serviços locais (catálogo SERVIÇOS). */
export function empresaEhServicosLocais(categoria: string | null | undefined): boolean {
  const c = String(categoria ?? '').toLowerCase().trim()
  return c === 'servicos_locais' || c === 'serviços locais' || c === 'servicos locais'
}

