import { ehCanalInboxMensageiroAdm } from '@/lib/canaisAdminVisibilidade'
import { excluirCanalMensageiroVisaoAdm, nomeNormCanal } from '@/lib/rotulosCanaisAdministracao'
import { slugCanalSegmentoEmpresa } from '@/lib/canaisEmpresaSlugs'

import { SEGMENTOS_EMPRESA_SLUG } from '@/lib/segmentosEmpresaGuia'

/** @type {readonly string[]} */
const CATEGORIAS_PROFISSIONAIS = ['motorista_app', 'van', 'taxista', 'guia', 'anfitriao'] as const

export type CanalParticaoAdmin = {
  id: string
  nome?: string | null
  tipo_publico?: string | null
  categoria?: string | null
  empresa_categoria?: string | null
  empresa_id?: string | null
  comunidade_prof?: string | null
  ordem_tipo?: string | null
  ordem_posicao?: number | null
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

function chaveSegmentoEmpresa(c: CanalParticaoAdmin): string | null {
  return slugCanalSegmentoEmpresa(c.categoria ?? c.empresa_categoria, c.nome)
}

function ehCanalGlobalSegmentoEmpresaAdm(c: CanalParticaoAdmin): boolean {
  if (c.tipo_publico !== 'empresa') return false
  if (c.empresa_id != null && String(c.empresa_id).trim() !== '') return false
  if (c.comunidade_prof != null && String(c.comunidade_prof).trim() !== '') return false
  const n = nomeNormCanal(c.nome)
  if (n === 'ADM' || n === 'FINANCEIRO') return false
  return chaveSegmentoEmpresa(c) != null && !canalEhProfissional(c)
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
    empresas: (() => {
      const candidatos = canaisOrdenados.filter((c) => ehCanalGlobalSegmentoEmpresaAdm(c))

      const best = new Map<string, CanalParticaoAdmin>()
      for (const c of candidatos) {
        const k = chaveSegmentoEmpresa(c)
        // Hospedagem: comunidade Anfitrião / Hospedagem (pasta PROFISSIONAIS) cobre o dual mode.
        if (!k || k === 'hospedagem') continue
        const cur = best.get(k)
        if (!cur) {
          best.set(k, c)
          continue
        }
        const score = (x: CanalParticaoAdmin) =>
          (x.ordem_tipo === 'fixo' ? 10 : 0) + (x.ordem_posicao != null ? 1 : 0)
        if (score(c) > score(cur)) best.set(k, c)
      }

      const ordem = [...SEGMENTOS_EMPRESA_SLUG]
      return [...best.values()].sort((a, b) => {
        const ka = chaveSegmentoEmpresa(a) ?? ''
        const kb = chaveSegmentoEmpresa(b) ?? ''
        return ordem.indexOf(ka as (typeof SEGMENTOS_EMPRESA_SLUG)[number]) -
          ordem.indexOf(kb as (typeof SEGMENTOS_EMPRESA_SLUG)[number])
      })
    })(),
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
