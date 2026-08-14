import { empresaEhSegmentoLojasParaguai } from '@/lib/cidade-empresa'

export type EmpresaCdeResumo = {
  id: string
  nome: string
  username: string
  fotoUrl: string | null
  categoria: string
  cidade: string
}

/** Empresa do segmento Lojas / Compras Paraguai em Ciudad del Este. */
export function empresaEhCdeSegmento(categoria: string | null | undefined, cidade: string | null | undefined) {
  return empresaEhSegmentoLojasParaguai(categoria, cidade)
}

export function filtrarEmpresasCde<T extends EmpresaCdeResumo>(empresas: T[]): T[] {
  return empresas.filter((e) => empresaEhCdeSegmento(e.categoria, e.cidade))
}
