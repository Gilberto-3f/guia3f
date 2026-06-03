import { ehCanalInboxMensageiroAdm } from '@/lib/canaisAdminVisibilidade'
import { excluirCanalMensageiroVisaoAdm, nomeNormCanal } from '@/lib/rotulosCanaisAdministracao'

import { CATEGORIAS_EMPRESA_DB, SEGMENTOS_EMPRESA_SLUG } from '@/lib/segmentosEmpresaGuia'

/** @type {readonly string[]} */
const CATEGORIAS_PROFISSIONAIS = ['motorista_app', 'van', 'taxista', 'guia', 'anfitriao'] as const

/** Valores legados (categoria) e rótulos atuais (cadastro / `empresa_categoria`). */
const CATEGORIAS_EMPRESAS = SEGMENTOS_EMPRESA_SLUG
const CATEGORIAS_EMPRESAS_ROTULO = CATEGORIAS_EMPRESA_DB

export type CanalParticaoAdmin = {
  id: string
  nome?: string | null
  tipo_publico?: string | null
  categoria?: string | null
  empresa_categoria?: string | null
  empresa_id?: string | null
}

function canalEMSegmentoNegocio(c: CanalParticaoAdmin) {
  const c1 = (c.categoria ?? '').trim()
  const c2 = (c.empresa_categoria ?? '').trim()
  const n = (c.nome ?? '').trim()
  for (const x of [c1, c2, n]) {
    const t = x.toLowerCase()
    if ((CATEGORIAS_EMPRESAS as readonly string[]).includes(t)) return true
    if ((CATEGORIAS_EMPRESAS_ROTULO as readonly string[]).includes(x)) return true
  }
  return false
}

function canalEhProfissional(c: CanalParticaoAdmin) {
  const cat = (c.categoria ?? '').trim().toLowerCase()
  if (cat && (CATEGORIAS_PROFISSIONAIS as readonly string[]).includes(cat)) return true
  const nome = (c.nome ?? '').trim().toLowerCase()
  return (CATEGORIAS_PROFISSIONAIS as readonly string[]).includes(nome)
}

function chaveProfissional(c: CanalParticaoAdmin): string | null {
  const cat = (c.categoria ?? '').trim().toLowerCase()
  if (cat && (CATEGORIAS_PROFISSIONAIS as readonly string[]).includes(cat)) return cat

  const rawNome = (c.nome ?? '').trim().toLowerCase()
  if (!rawNome) return null

  const nome = rawNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  if (nome === 'taxistas') return 'taxista'
  if (nome === 'guias') return 'guia'
  if (nome === 'vans') return 'van'
  if (nome === 'anfitrioes') return 'anfitriao'
  if (nome === 'motoristas_app' || nome === 'motoristas app') return 'motorista_app'

  if ((CATEGORIAS_PROFISSIONAIS as readonly string[]).includes(nome)) return nome
  return null
}

/**
 * Visão admin (Mensageiro ADM): mesmas pastas da lista — exclui canais ocultos/legados fora das pastas.
 */
export function particionarVisaoAdminTodos(canaisOrdenados: CanalParticaoAdmin[]) {
  return {
    administrador: canaisOrdenados.filter(
      (c) =>
        ehCanalInboxMensageiroAdm(c) ||
        (c.tipo_publico === 'admin' && c.categoria === 'admin' && !excluirCanalMensageiroVisaoAdm(c)),
    ),
    administracaoProf: canaisOrdenados.filter(
      (c) =>
        c.tipo_publico === 'profissional' &&
        (c.categoria === 'admin' || nomeNormCanal(c.nome) === 'FINANCEIRO'),
    ),
    profissionais: (() => {
      const candidatos = canaisOrdenados.filter((c) => {
        const cat = (c.categoria ?? '').trim().toLowerCase()
        const isProf =
          c.tipo_publico === 'profissional' && cat && (CATEGORIAS_PROFISSIONAIS as readonly string[]).includes(cat)
        return isProf || canalEhProfissional(c) || chaveProfissional(c) != null
      })

      const best = new Map<string, CanalParticaoAdmin>()
      for (const c of candidatos) {
        const k = chaveProfissional(c)
        if (!k) continue
        const cur = best.get(k)
        if (!cur) {
          best.set(k, c)
          continue
        }
        const catC = (c.categoria ?? '').trim().toLowerCase()
        const catCur = (cur.categoria ?? '').trim().toLowerCase()
        const scoreC =
          (c.tipo_publico === 'profissional' ? 10 : 0) +
          (catC && (CATEGORIAS_PROFISSIONAIS as readonly string[]).includes(catC) ? 5 : 0)
        const scoreCur =
          (cur.tipo_publico === 'profissional' ? 10 : 0) +
          (catCur && (CATEGORIAS_PROFISSIONAIS as readonly string[]).includes(catCur) ? 5 : 0)
        if (scoreC > scoreCur) best.set(k, c)
      }

      return [...best.values()]
    })(),
    /** Canal Financeiro empresa é pessoal; hub ADM usa o canal profissional (evita duplicata na lista). */
    administracaoEmp: [] as CanalParticaoAdmin[],
    empresas: canaisOrdenados.filter(
      (c) =>
        c.tipo_publico === 'empresa' &&
        nomeNormCanal(c.nome) !== 'ADM' &&
        nomeNormCanal(c.nome) !== 'FINANCEIRO' &&
        canalEMSegmentoNegocio(c) &&
        !canalEhProfissional(c),
    ),
  }
}

export function idsEmParticaoVisaoAdmin(part: ReturnType<typeof particionarVisaoAdminTodos>): Set<string> {
  const s = new Set<string>()
  for (const arr of Object.values(part)) {
    for (const c of arr) s.add(c.id)
  }
  return s
}

/** IDs dos canais que o admin vê na lista (pastas Mensageiro ADM). */
export function idsCanaisVisiveisAdmin(canais: CanalParticaoAdmin[]): Set<string> {
  return idsEmParticaoVisaoAdmin(particionarVisaoAdminTodos(canais))
}
