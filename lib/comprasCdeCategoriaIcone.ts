'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Car,
  Dumbbell,
  Monitor,
  Pill,
  Puzzle,
  Refrigerator,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Wine,
  Wrench,
  Package,
} from 'lucide-react'
import {
  slugCategoriaProdutoPorNome,
  type CategoriaProdutoSlug,
} from '@/lib/comprasCdeCatalogo'

const MAPA: Record<CategoriaProdutoSlug, LucideIcon> = {
  smartphones: Smartphone,
  eletrodomesticos: Refrigerator,
  eletronicos: Monitor,
  'perfumaria-cosmeticos': Sparkles,
  'bebidas-alimentos': Wine,
  'vestuario-calcados': Shirt,
  brinquedos: Puzzle,
  'artigos-automotivo': Car,
  'artigos-esportivos': Dumbbell,
  ferramentas: Wrench,
  'produtos-farmaceuticos': Pill,
  'departamento-geral': Store,
}

/** Ícone Lucide da categoria do produto (drawer Catálogo / Compras CDE). */
export function iconeCategoriaProduto(
  slugOuNome: string | null | undefined,
): LucideIcon {
  const raw = String(slugOuNome ?? '').trim()
  if (!raw) return Package
  if (raw in MAPA) return MAPA[raw as CategoriaProdutoSlug]
  const slug = slugCategoriaProdutoPorNome(raw)
  if (slug && slug in MAPA) return MAPA[slug]
  return Package
}
