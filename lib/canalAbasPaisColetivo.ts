import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'
import { inferCodigoPaisEmpresa } from '@/lib/empresaPaisUi'
import { toSlugComunidadeProf } from '@/lib/canaisProfissionaisListaUi'
import { isCanalFinanceiroEmpresa, SEGMENTOS_EMPRESA_SLUG, slugCanalSegmentoEmpresa } from '@/lib/canaisEmpresaSlugs'
import {
  CATEGORIAS_PROFISSIONAIS_SLUG,
  isCanalFinanceiroProfissional,
  slugCanalComunidadeProfissional,
} from '@/lib/canaisProfissionalSlugs'
import { canalMensageiroAdmSemAbasPais } from '@/lib/rotulosCanaisAdministracao'

/** Ordem das abas: global primeiro, depois países. */
export const PAISES_ABAS_CANAL_COLETIVO = ['geral', 'BR', 'AR', 'PY'] as const

export type CodigoPaisAba = (typeof PAISES_ABAS_CANAL_COLETIVO)[number]

type CanalAbasInput = {
  nome?: string | null
  tipo_publico?: string | null
  empresa_id?: string | null
  comunidade_prof?: string | null
  categoria?: string | null
}

const COMUNIDADES_EMPRESA_SLUG = ['guia', 'taxista', 'van', 'motorista_app', 'anfitriao'] as const

function slugComunidadeEmpresa(canal: CanalAbasInput): string | null {
  const slug = toSlugComunidadeProf(canal.comunidade_prof != null ? String(canal.comunidade_prof) : '')
  if (slug && (COMUNIDADES_EMPRESA_SLUG as readonly string[]).includes(slug)) return slug
  return null
}

function slugComunidadeAdmin(canal: CanalAbasInput): string | null {
  return slugCanalComunidadeProfissional(
    canal.categoria != null ? String(canal.categoria) : null,
    canal.nome != null ? String(canal.nome) : null,
  )
}

/**
 * Canais coletivos da pasta Profissionais (ADM: broadcast por categoria; Empresa: canal por comunidade).
 */
export function canalTemAbasPaisColetivo(
  canal: CanalAbasInput | null | undefined,
  userTipo: 'admin' | 'empresa' | 'profissional' | 'turista' | null,
): boolean {
  if (!canal || canalMensageiroAdmSemAbasPais(canal.nome)) return false

  if (userTipo === 'admin') {
    if (canal.empresa_id != null) return false
    if (canalMensageiroAdmSemAbasPais(canal.nome)) return false

    if (canal.tipo_publico === 'profissional') {
      if (isCanalFinanceiroProfissional(canal.nome)) return false
      const slug = slugComunidadeAdmin(canal)
      return slug != null && (CATEGORIAS_PROFISSIONAIS_SLUG as readonly string[]).includes(slug)
    }

    if (canal.tipo_publico === 'empresa') {
      if (isCanalFinanceiroEmpresa(canal.nome)) return false
      const slug = slugCanalSegmentoEmpresa(
        canal.categoria != null ? String(canal.categoria) : null,
        canal.nome != null ? String(canal.nome) : null,
      )
      return slug != null && (SEGMENTOS_EMPRESA_SLUG as readonly string[]).includes(slug)
    }

    return false
  }

  if (userTipo === 'empresa') {
    if (canal.tipo_publico !== 'empresa') return false
    if (canal.empresa_id == null) return false
    if (isCanalFinanceiroEmpresa(canal.nome)) return false
    return slugComunidadeEmpresa(canal) != null
  }

  return false
}

/** Normaliza `profissionais.pais` (texto) para código de aba. */
export function profissionalPaisParaAba(pais: string | null | undefined): CodigoPaisAba {
  const p = String(pais ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!p) return 'geral'
  if (p === 'br' || p.includes('brasil')) return 'BR'
  if (p === 'py' || p.includes('paraguai') || p.includes('paraguay')) return 'PY'
  if (p === 'ar' || p.includes('argentina')) return 'AR'
  return 'geral'
}

/** Profissional deve filtrar leitura por país nestes canais. */
export function canalFiltraLeituraPorPaisProfissional(canal: CanalAbasInput | null | undefined): boolean {
  if (!canal) return false
  if (canal.tipo_publico === 'profissional' && canal.empresa_id == null) {
    if (isCanalFinanceiroProfissional(canal.nome)) return false
    return slugComunidadeAdmin(canal) != null
  }
  if (canal.tipo_publico === 'empresa' && canal.empresa_id != null && canal.comunidade_prof) {
    return slugComunidadeEmpresa(canal) != null
  }
  return false
}

/** Empresa lê inbox/segmento global filtrado pelo país inferido da cidade. */
export function canalFiltraLeituraPorPaisEmpresa(canal: CanalAbasInput | null | undefined): boolean {
  if (!canal) return false
  if (canal.tipo_publico !== 'empresa' || canal.empresa_id != null) return false
  if (isCanalFinanceiroEmpresa(canal.nome)) return false
  const slug = slugCanalSegmentoEmpresa(
    canal.categoria != null ? String(canal.categoria) : null,
    canal.nome != null ? String(canal.nome) : null,
  )
  return slug != null && (SEGMENTOS_EMPRESA_SLUG as readonly string[]).includes(slug)
}

export function empresaPaisParaAba(cidade: string | null | undefined): CodigoPaisAba {
  const cod = inferCodigoPaisEmpresa(cidade)
  if (cod === 'BR' || cod === 'AR' || cod === 'PY') return cod
  return 'geral'
}

/**
 * - `mensageiro_aba`: cada aba (bandeira / Todos) é um mensageiro isolado (ADM e empresa ao publicar).
 * - `leitura_publico`: destinatário vê mensagens do seu país + avisos em «Todos».
 */
export type ModoFiltroPaisCanal = 'mensageiro_aba' | 'leitura_publico'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryComPais = PostgrestFilterBuilder<any, any, any, any, any>

export function aplicarFiltroPaisMensagensCanal(
  query: QueryComPais,
  paisTab: string | undefined,
  modo: ModoFiltroPaisCanal,
): QueryComPais {
  const tab = (paisTab && String(paisTab).trim()) || 'geral'

  if (modo === 'mensageiro_aba') {
    return query.eq('pais', tab)
  }

  if (tab === 'geral') {
    return query.eq('pais', 'geral')
  }
  return query.or(`pais.eq.${tab},pais.eq.geral`)
}

/** Realtime: mensagem pertence à aba/modo atual. */
export function mensagemCanalVisivelNoFiltroPais(
  paisMsg: string | null | undefined,
  paisTab: string | undefined,
  modo: ModoFiltroPaisCanal,
): boolean {
  const msg = (paisMsg && String(paisMsg).trim()) || 'geral'
  const tab = (paisTab && String(paisTab).trim()) || 'geral'

  if (modo === 'mensageiro_aba') {
    return msg === tab
  }
  if (tab === 'geral') return msg === 'geral'
  return msg === tab || msg === 'geral'
}
