'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MessageCircle, Building2, Crown, ChevronUp, ChevronDown, Landmark } from 'lucide-react'
import { excluirCanalMensageiroVisaoAdm, rotuloNomeCanalAdministracao } from '@/lib/rotulosCanaisAdministracao'

/** @type {readonly string[]} */
const CATEGORIAS_PROFISSIONAIS = ['motorista_app', 'van', 'taxista', 'guia', 'anfitriao']

/** Valores legados (categoria) e rótulos atuais (cadastro / `empresa_categoria`). */
const CATEGORIAS_EMPRESAS = ['gastronomia', 'lojas', 'passeios', 'hospedagem']
const CATEGORIAS_EMPRESAS_ROTULO = ['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem']

/**
 * @param {Canal} c
 */
function canalEMSegmentoNegocio(c) {
  const c1 = (c.categoria ?? '').trim()
  const c2 = (c.empresa_categoria ?? '').trim()
  const n = (c.nome ?? '').trim()
  for (const x of [c1, c2, n]) {
    const t = x.toLowerCase()
    if (CATEGORIAS_EMPRESAS.includes(t)) return true
    if (CATEGORIAS_EMPRESAS_ROTULO.includes(x)) return true
  }
  return false
}

/**
 * @param {string | null | undefined} nome
 */
function nomeNorm(nome) {
  return (nome ?? '').trim().toUpperCase()
}

/**
 * @typedef {{
 *   id: string
 *   nome: string
 *   tipo_publico: string | null
 *   categoria: string | null
 *   empresa_categoria?: string | null
 *   empresa_id?: string | null
 *   pais: string | null
 *   ordem_tipo: string | null
 *   ordem_posicao?: number | null
 *   ultima_mensagem_em: string | null
 *   nao_lidas?: number
 * }} Canal
 */

/**
 * @param {Canal} c
 * @returns {number}
 */
function prioridadeAdmFin(c) {
  const n = nomeNorm(c.nome)
  if (n === 'ADM') return 0
  if (n === 'FINANCEIRO') return 1
  return 2
}

/**
 * Junta e ordena a pasta ADMINISTRAÇÃO (múltiplas origens): fixos, depois desempate ADM antes de Financeiro.
 * @param {Canal[]} lista
 */
function ordenarBlocoAdministracaoUnificada(lista) {
  const fixos = lista.filter((c) => c.ordem_tipo === 'fixo')
  const rot = lista.filter((c) => c.ordem_tipo !== 'fixo')
  fixos.sort((a, b) => {
    const pa = a.ordem_posicao ?? 0
    const pb = b.ordem_posicao ?? 0
    if (pa !== pb) return pa - pb
    return prioridadeAdmFin(a) - prioridadeAdmFin(b)
  })
  rot.sort((a, b) => {
    const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
    const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
    if (tb !== ta) return tb - ta
    return prioridadeAdmFin(a) - prioridadeAdmFin(b)
  })
  return [...fixos, ...rot]
}

/**
 * @param {Canal[]} canaisOrdenados
 * @param {string | null | undefined} tipoPublico
 */
function particionarPorPerfil(canaisOrdenados, tipoPublico) {
  const tp = tipoPublico ?? ''

  if (tp === 'admin') {
    return {
      administrador: canaisOrdenados.filter(
        (c) => c.tipo_publico === 'admin' && c.categoria === 'admin' && !excluirCanalMensageiroVisaoAdm(c),
      ),
      administracaoProf: /** @type {Canal[]} */ ([]),
      profissionais: /** @type {Canal[]} */ ([]),
      administracaoEmp: /** @type {Canal[]} */ ([]),
      empresas: /** @type {Canal[]} */ ([]),
    }
  }

  if (tp === 'profissional') {
    return {
      administrador: /** @type {Canal[]} */ ([]),
      administracaoProf: canaisOrdenados.filter(
        (c) => c.tipo_publico === 'profissional' && (c.categoria === 'admin' || nomeNorm(c.nome) === 'FINANCEIRO'),
      ),
      profissionais: canaisOrdenados.filter(
        (c) => c.tipo_publico === 'profissional' && c.categoria != null && CATEGORIAS_PROFISSIONAIS.includes(c.categoria),
      ),
      administracaoEmp: /** @type {Canal[]} */ ([]),
      empresas: /** @type {Canal[]} */ ([]),
    }
  }

  if (tp === 'empresa') {
    return {
      administrador: /** @type {Canal[]} */ ([]),
      administracaoProf: /** @type {Canal[]} */ ([]),
      profissionais: /** @type {Canal[]} */ ([]),
      administracaoEmp: canaisOrdenados.filter((c) => c.tipo_publico === 'empresa' && nomeNorm(c.nome) === 'ADM'),
      empresas: canaisOrdenados.filter(
        (c) => c.tipo_publico === 'empresa' && nomeNorm(c.nome) !== 'ADM' && canalEMSegmentoNegocio(c),
      ),
    }
  }

  return {
    administrador: /** @type {Canal[]} */ ([]),
    administracaoProf: /** @type {Canal[]} */ ([]),
    profissionais: /** @type {Canal[]} */ ([]),
    administracaoEmp: /** @type {Canal[]} */ ([]),
    empresas: /** @type {Canal[]} */ ([]),
  }
}

/**
 * Visão admin: todos os tipos carregados — mesmas regras do relatório, com rótulos distintos quando há colisão de nome.
 * @param {Canal[]} canaisOrdenados
 */
function particionarVisaoAdminTodos(canaisOrdenados) {
  /**
   * Só `FINANCEIRO` global (empresa, sem `empresa_id`). O ADM de `tipo_publico` empresa
   * não entra na lista: já existe o canal `admin` com ADM — evita duas linhas "ADM".
   */
  const administracaoEmp = canaisOrdenados.filter(
    (c) => c.tipo_publico === 'empresa' && c.empresa_id == null && nomeNorm(c.nome) === 'FINANCEIRO',
  )
  return {
    administrador: canaisOrdenados.filter(
      (c) => c.tipo_publico === 'admin' && c.categoria === 'admin' && !excluirCanalMensageiroVisaoAdm(c),
    ),
    administracaoProf: canaisOrdenados.filter(
      (c) => c.tipo_publico === 'profissional' && (c.categoria === 'admin' || nomeNorm(c.nome) === 'FINANCEIRO'),
    ),
    profissionais: canaisOrdenados.filter(
      (c) => c.tipo_publico === 'profissional' && c.categoria != null && CATEGORIAS_PROFISSIONAIS.includes(c.categoria),
    ),
    administracaoEmp: /** @type {Canal[]} */ (administracaoEmp),
    /** Somente canais vinculados a segmento de negócios (categoria) — evita duplicar ADM. */
    empresas: canaisOrdenados.filter(
      (c) => c.tipo_publico === 'empresa' && nomeNorm(c.nome) !== 'ADM' && nomeNorm(c.nome) !== 'FINANCEIRO' && canalEMSegmentoNegocio(c),
    ),
  }
}

/**
 * @param {Canal[]} canaisOrdenados
 * @param {{ administrador: Canal[]; administracaoProf: Canal[]; profissionais: Canal[]; administracaoEmp: Canal[]; empresas: Canal[] }} part
 */
function idsEmParticao(part) {
  const s = new Set()
  for (const arr of Object.values(part)) {
    for (const c of arr) s.add(c.id)
  }
  return s
}

/**
 * @param {{
 *   tipoPublico?: string | null
 *   paisFiltro?: string
 *   onSelectCanal: (c: Canal) => void
 *   canalSelecionadoId?: string
 *   agruparPorTipo?: boolean
 * }} props
 */
export default function ListaCanais({
  tipoPublico,
  paisFiltro = 'geral',
  onSelectCanal,
  canalSelecionadoId,
  agruparPorTipo = false,
}) {
  const [canais, setCanais] = useState(/** @type {Canal[]} */ ([]))
  const [loading, setLoading] = useState(true)

  const part = useMemo(() => {
    if (agruparPorTipo) return particionarVisaoAdminTodos(canais)
    return particionarPorPerfil(canais, tipoPublico)
  }, [agruparPorTipo, tipoPublico, canais])

  const particionIds = useMemo(() => idsEmParticao(part), [part])

  const adminUnificado = useMemo(() => {
    const all = [
      ...(part.administrador ?? []),
      ...(part.administracaoProf ?? []),
      ...(part.administracaoEmp ?? []),
    ]
    if (all.length === 0) return /** @type {Canal[]} */ ([])
    return ordenarBlocoAdministracaoUnificada(all)
  }, [part])

  const gruposIniciais = useMemo(() => {
    const keys = /** @type {const} */ (['administracaoUnificada', 'profissionais', 'empresas'])
    const init = /** @type {Record<string, boolean>} */ ({})
    const adminUnificadoLen = (part.administrador?.length ?? 0) + (part.administracaoProf?.length ?? 0) + (part.administracaoEmp?.length ?? 0)
    init.administracaoUnificada = adminUnificadoLen > 0
    init.profissionais = (part.profissionais?.length ?? 0) > 0
    init.empresas = (part.empresas?.length ?? 0) > 0
    return init
  }, [part])

  const [gruposAbertos, setGruposAbertos] = useState(/** @type {Record<string, boolean>} */ ({}))

  useEffect(() => {
    setGruposAbertos((prev) => {
      const next = { ...gruposIniciais }
      for (const k of Object.keys(next)) {
        if (prev[k] != null) next[k] = prev[k]
      }
      return next
    })
  }, [gruposIniciais])

  useEffect(() => {
    const carregarCanais = async () => {
      setLoading(true)
      try {
        let query = supabase.from('canais').select('*').eq('ativo', true)

        if (tipoPublico != null && tipoPublico !== '') {
          query = query.eq('tipo_publico', tipoPublico)
        }

        if (paisFiltro && paisFiltro !== 'geral') {
          query = query.or(`pais.eq.${paisFiltro},pais.eq.geral`)
        }

        const { data, error } = await query

        if (error) throw error

        const lista = data ?? []
        const fixos = lista.filter((c) => c.ordem_tipo === 'fixo').sort((a, b) => (a.ordem_posicao ?? 0) - (b.ordem_posicao ?? 0))
        const rotativos = lista.filter((c) => c.ordem_tipo !== 'fixo')
        rotativos.sort((a, b) => {
          const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
          const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
          return tb - ta
        })

        setCanais([...fixos, ...rotativos])
      } catch (e) {
        console.error('Erro ao carregar canais:', e)
      } finally {
        setLoading(false)
      }
    }

    void carregarCanais()
  }, [tipoPublico, paisFiltro])

  /**
   * @param {Canal} canal
   */
  const getIcon = (canal) => {
    const n = nomeNorm(canal.nome)
    if (n === 'ADM') return Crown
    if (n === 'FINANCEIRO') return Landmark
    if (canal.tipo_publico === 'empresa') return Building2
    return MessageCircle
  }

  const toggleGrupo = (grupo) => {
    setGruposAbertos((prev) => {
      const aberto = prev[grupo] !== false
      return { ...prev, [grupo]: !aberto }
    })
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  /**
   * @param {Canal} canal
   * @param {{ blocoAdministracao?: boolean }} [opts]
   */
  function renderRow(canal, opts = {}) {
    const Icon = getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    const label = opts.blocoAdministracao ? rotuloNomeCanalAdministracao(canal.nome) : canal.nome
    return (
      <button
        key={canal.id}
        type="button"
        onClick={() => onSelectCanal(canal)}
        className={`flex w-full items-center gap-3 border-b border-gray-100 p-4 text-left transition-colors ${
          isActive ? 'bg-[#0097b2]/5' : 'hover:bg-gray-50'
        }`}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isActive ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-800">{label}</h3>
          {canal.nao_lidas != null && canal.nao_lidas > 0 ? (
            <span className="mt-1 inline-block rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{canal.nao_lidas}</span>
          ) : null}
        </div>
      </button>
    )
  }

  /**
   * @param {{ id: string; titulo: string; itens: Canal[]; administracao?: boolean }} args
   */
  function renderGrupoChevron({ id, titulo, itens, administracao }) {
    if (itens.length === 0) return null
    const aberto = gruposAbertos[id] !== false
    const adm = administracao === true
    return (
      <div className="border-b border-gray-100">
        <button
          type="button"
          onClick={() => toggleGrupo(id)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-base"
        >
          <span className="font-bold leading-snug text-[#0097b2]">{titulo}</span>
          {aberto ? (
            <ChevronUp size={18} aria-hidden className="shrink-0 text-[#0097b2]" />
          ) : (
            <ChevronDown size={18} aria-hidden className="shrink-0 text-[#0097b2]" />
          )}
        </button>
        {aberto ? (
          <div>
            {itens.map((canal) => (
              <div key={canal.id} className="pl-4">
                {renderRow(canal, { blocoAdministracao: adm })}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const usarLayoutChevron =
    agruparPorTipo ||
    tipoPublico === 'admin' ||
    tipoPublico === 'profissional' ||
    tipoPublico === 'empresa'

  if (usarLayoutChevron) {
    const outros = canais.filter((c) => {
      if (particionIds.has(c.id)) return false
      if (c.tipo_publico === 'empresa' && c.empresa_id == null && nomeNorm(c.nome) === 'ADM') return false
      if (agruparPorTipo && excluirCanalMensageiroVisaoAdm(c)) return false
      return true
    })

    return (
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {renderGrupoChevron({
          id: 'administracaoUnificada',
          titulo: agruparPorTipo ? 'MENSAGEIRO ADM' : 'ADMINISTRAÇÃO',
          itens: adminUnificado,
          administracao: true,
        })}
        {renderGrupoChevron({ id: 'profissionais', titulo: 'PROFISSIONAIS', itens: part.profissionais })}
        {renderGrupoChevron({ id: 'empresas', titulo: 'EMPRESAS', itens: part.empresas })}
        {outros.map((canal) => renderRow(canal))}
      </div>
    )
  }

  return <div className="overflow-hidden rounded-xl bg-white shadow-sm">{canais.map((canal) => renderRow(canal))}</div>
}
