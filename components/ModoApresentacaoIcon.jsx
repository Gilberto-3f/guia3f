'use client'

import {
  Bed,
  Briefcase,
  Building2,
  Bus,
  Car,
  Compass,
  Home,
  MapPinned,
  ShoppingBag,
  Smartphone,
  User,
  Utensils,
} from 'lucide-react'

/** @type {Record<string, import('lucide-react').LucideIcon>} */
const MAP = {
  turista: User,
  guia: Compass,
  taxista: Car,
  van: Bus,
  motorista_app: Smartphone,
  anfitriao: Home,
  gastro: Utensils,
  lojas_py: ShoppingBag,
  passeios: MapPinned,
  hospedagem: Bed,
  empresa: Building2,
  profissional: Briefcase,
}

/**
 * Ícone do modo apresentação por chave estável (persistida).
 * @param {{ iconeKey?: string | null, className?: string }} props
 */
export default function ModoApresentacaoIcon({ iconeKey, className = 'h-5 w-5' }) {
  const Cmp = (iconeKey && MAP[iconeKey]) || User
  return <Cmp className={className} strokeWidth={1.75} aria-hidden />
}
