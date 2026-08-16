import type { ModoAnfitriao } from '@/lib/anfitriaoDualMode'
import { profissionalOperaComoEmpresaHospedagem } from '@/lib/anfitriaoDualMode'
import type { ModoGuia } from '@/lib/guiaDualMode'
import { profissionalOperaComoEmpresaAgencia } from '@/lib/guiaDualMode'
import type { ModoVan } from '@/lib/vanDualMode'
import { profissionalOperaComoEmpresaAgenciaVan } from '@/lib/vanDualMode'

export type StoryAutorTipoPublicacao = 'turista' | 'profissional' | 'empresa' | string

export type DualModeStoryPublicacaoInput = {
  role: string | null | undefined
  ehAnfitriao: boolean
  modoAnfitriao: ModoAnfitriao | null | undefined
  empresaHospedagemId: string | null | undefined
  empresaHospedagemLiberada?: boolean
  ehGuia: boolean
  modoGuia: ModoGuia | null | undefined
  empresaAgenciaId: string | null | undefined
  empresaAgenciaLiberada?: boolean
  ehVan: boolean
  modoVan: ModoVan | null | undefined
  empresaAgenciaVanId: string | null | undefined
  empresaAgenciaVanLiberada?: boolean
}

/** Dual-mode anfitrião / guia / van em modo empresa (hospedagem ou agência). */
export function profissionalOperaComoEmpresaEmAlgumDualMode(
  input: DualModeStoryPublicacaoInput,
): boolean {
  const role = input.role
  return (
    profissionalOperaComoEmpresaHospedagem(
      role,
      input.ehAnfitriao,
      input.modoAnfitriao,
      input.empresaHospedagemId,
      input.empresaHospedagemLiberada === true,
    ) ||
    profissionalOperaComoEmpresaAgencia(
      role,
      input.ehGuia,
      input.modoGuia,
      input.empresaAgenciaId,
      input.empresaAgenciaLiberada === true,
    ) ||
    profissionalOperaComoEmpresaAgenciaVan(
      role,
      input.ehVan,
      input.modoVan,
      input.empresaAgenciaVanId,
      input.empresaAgenciaVanLiberada === true,
    )
  )
}

/**
 * Persona do story na publicação: modo empresa → `empresa`;
 * caso contrário usa o role do usuário (profissional / turista / empresa nativa).
 */
export function resolverStoryAutorTipoPublicacao(
  role: string | null | undefined,
  operaComoEmpresa: boolean,
): StoryAutorTipoPublicacao {
  if (operaComoEmpresa) return 'empresa'
  const r = String(role ?? '').trim()
  return r || 'turista'
}
