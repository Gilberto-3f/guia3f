import type { LucideIcon } from 'lucide-react'
import { Calendar, Car, Hotel, Package, ShoppingBag, Ticket, Utensils } from 'lucide-react'

export const ROTULO_ABA_SERVICO: Record<string, string> = {
  gastronomia: 'Reservar',
  Restaurantes: 'Reservar',
  passeios: 'Tickets',
  Atrativos: 'Tickets',
  lojas: 'Produtos',
  Lojas: 'Produtos',
  hospedagem: 'Reservar',
  Hospedagem: 'Reservar',
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

