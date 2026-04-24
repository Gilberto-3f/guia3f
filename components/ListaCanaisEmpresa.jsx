'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, ChevronUp, Crown, Landmark, Users } from 'lucide-react'
import { rotuloNomeCanalAdministracao } from '@/lib/rotulosCanaisAdministracao'

/** @type {readonly string[]} */
const COMUNIDADES_PROFISSIONAIS = ['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao']

/**
 * @param {string | null | undefined} nome
 */
function nomeNorm(nome) {
  return (nome ?? '').trim().toUpperCase()
}

/**
 * Título no cabeçalho / lista (comunidade → rótulo).
 * @param {string | null | undefined} comunidade
 */
export function tituloCanalEmpresaLista(comunidade) {
  const c = String(comunidade ?? '').trim()
  const map = {
    Van: 'Motoristas Van',
    Taxista: 'Taxistas',
    Guia: 'Guias de Turismo',
    'Motorista de App': 'Motoristas App',
    Anfitriao: 'Anfitriões',
  }
  return map[c] ?? (c || 'Profissionais')
}

/**
 * @typedef {{
 *   id: string
 *   nome: string
 *   tipo_publico: string | null
 *   categoria: string | null
  *   comunidade_prof?: string | null
  *   empresa_id?: string | null
 *   ordem_tipo: string | null
 *   ordem_posicao?: number | null
 *   ultima_mensagem_em: string | null
 * }} Canal
 */

/**
 * @param {string | null | undefined} n
 * @returns {number}
 */
function prioridadeAdmFinNome(n) {
  const u = (n ?? '').trim().toUpperCase()
  if (u === 'ADM') return 0
  if (u === 'FINANCEIRO') return 1
  return 2
}

function ordenarCanais(lista) {
  const fixos = lista.filter((c) => c.ordem_tipo === 'fixo').sort((a, b) => (a.ordem_posicao ?? 0) - (b.ordem_posicao ?? 0))
  const rotativos = lista.filter((c) => c.ordem_tipo !== 'fixo')
  rotativos.sort((a, b) => {
    const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
    const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
    return tb - ta
  })
  return [...fixos, ...rotativos]
}

/**
 * Garante ADM antes de Financeiro na pasta administração.
 * @param {Array<{ nome?: string | null, ordem_tipo?: string | null, ordem_posicao?: number | null, ultima_mensagem_em?: string | null }>} lista
 */
function ordenarCanaisAdministracaoEmpresa(lista) {
  if (lista.length === 0) return /** @type {typeof lista} */ ([])
  const base = ordenarCanais([...lista])
  return base.sort((a, b) => {
    const pa = prioridadeAdmFinNome(a.nome)
    const pb = prioridadeAdmFinNome(b.nome)
    if (pa !== pb) return pa - pb
    if (a.ordem_tipo === 'fixo' && b.ordem_tipo === 'fixo') {
      return (a.ordem_posicao ?? 0) - (b.ordem_posicao ?? 0)
    }
    const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
    const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
    return tb - ta
  })
}

/**
 * @param {{
 *   onSelectCanal: (c: Canal) => void
 *   canalSelecionadoId?: string
 * }} props
 */
export default function ListaCanaisEmpresa({ onSelectCanal, canalSelecionadoId }) {
  const [canais, setCanais] = useState(/** @type {Canal[]} */ ([]))
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState(/** @type {string | null} */ (null))

  const part = useMemo(() => {
    const administracao = ordenarCanaisAdministracaoEmpresa(
      canais.filter(
        (c) =>
          c.tipo_publico === 'empresa' &&
          c.empresa_id == null &&
          (nomeNorm(c.nome) === 'ADM' || nomeNorm(c.nome) === 'FINANCEIRO'),
      ),
    )
    const profissionais = canais
      .filter((c) => c.tipo_publico === 'empresa' && empresaId && String(c.empresa_id ?? '') === String(empresaId))
      .filter((c) => c.comunidade_prof != null && COMUNIDADES_PROFISSIONAIS.includes(String(c.comunidade_prof)))
    return { administracao, profissionais }
  }, [canais, empresaId])

  const gruposIniciais = useMemo(
    () => ({
      administracao: part.administracao.length > 0,
      profissionais: part.profissionais.length > 0,
    }),
    [part],
  )

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

  const idsMonitor = useMemo(() => canais.map((c) => c.id), [canais])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) {
        setCanais([])
        return
      }
      const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', uid).maybeSingle()
      const empId = emp?.id != null ? String(emp.id) : null
      setEmpresaId(empId)

      const { data, error } = await supabase
        .from('canais')
        .select('id, nome, tipo_publico, categoria, comunidade_prof, empresa_id, ultima_mensagem_em, ordem_tipo, ordem_posicao')
        .eq('tipo_publico', 'empresa')
        .eq('ativo', true)

      if (error) throw error
      const lista = /** @type {Canal[]} */ (data ?? [])
      const filtrada = lista.filter((c) => {
        if (c.empresa_id == null) {
          return nomeNorm(c.nome) === 'ADM' || nomeNorm(c.nome) === 'FINANCEIRO'
        }
        return empId != null && String(c.empresa_id ?? '') === String(empId)
      })
      setCanais(ordenarCanais(filtrada))
    } catch (e) {
      console.error('Erro ao carregar canais empresa:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (idsMonitor.length === 0) return

    const ch = supabase.channel('lista-canais-empresa-mensagens')
    for (const canalId of idsMonitor) {
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_canal', filter: `canal_id=eq.${canalId}` },
        () => {
          void carregar()
        },
      )
    }
    void ch.subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [idsMonitor, carregar])

  /**
   * @param {Canal} canal
   */
  const getIcon = (canal) => {
    if (nomeNorm(canal.nome) === 'ADM') return Crown
    if (nomeNorm(canal.nome) === 'FINANCEIRO') return Landmark
    return Users
  }

  /**
   * @param {Canal} canal
   */
  function renderRow(canal) {
    const Icon = getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    const label =
      canal.empresa_id == null && (nomeNorm(canal.nome) === 'ADM' || nomeNorm(canal.nome) === 'FINANCEIRO')
        ? rotuloNomeCanalAdministracao(canal.nome)
        : canal.nome
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
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isActive ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-800">{label}</h3>
        </div>
      </button>
    )
  }

  const toggleGrupo = (id) => {
    setGruposAbertos((prev) => {
      const aberto = prev[id] !== false
      return { ...prev, [id]: !aberto }
    })
  }

  /**
   * @param {{ id: string; titulo: string; itens: Canal[]; forcarVazio?: boolean; mensagemVazio?: string }} args
   */
  function renderGrupo({ id, titulo, itens, forcarVazio, mensagemVazio }) {
    if (itens.length === 0 && !forcarVazio) return null
    const aberto = gruposAbertos[id] !== false
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
          itens.length === 0 && mensagemVazio ? (
            <p className="px-4 pb-4 pl-8 text-sm text-gray-500">{mensagemVazio}</p>
          ) : (
            <div>
              {itens.map((canal) => (
                <div key={canal.id} className="pl-4">
                  {renderRow(canal)}
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl shadow-sm">
        {renderGrupo({ id: 'administracao', titulo: 'ADMINISTRAÇÃO', itens: part.administracao })}
        {renderGrupo({ id: 'profissionais', titulo: 'PROFISSIONAIS', itens: ordenarCanais(part.profissionais) })}
      </div>
    </div>
  )
}
