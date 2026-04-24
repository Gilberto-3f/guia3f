'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bus, Car, ChevronDown, ChevronUp, Crown, Home, Landmark, MapPinned, Smartphone, Users } from 'lucide-react'

/** @type {readonly string[]} */
const COMUNIDADES_PROFISSIONAIS = ['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao']

const META_COMUNIDADE = /** @type {const} */ ({
  Guia: { Icon: MapPinned, rótulo: 'Guia' },
  Taxista: { Icon: Car, rótulo: 'Taxista' },
  Van: { Icon: Bus, rótulo: 'Van' },
  'Motorista de App': { Icon: Smartphone, rótulo: 'App' },
  Anfitriao: { Icon: Home, rótulo: 'Anfitrião' },
})

/**
 * @param {string} comu
 */
function metaAbaComunidade(comu) {
  if (Object.prototype.hasOwnProperty.call(META_COMUNIDADE, comu)) {
    return /** @type {{ Icon: import('lucide-react').LucideIcon, rótulo: string }} */ (META_COMUNIDADE[/** @type {keyof typeof META_COMUNIDADE} */ (comu)])
  }
  return { Icon: Users, rótulo: comu }
}

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
  const [comunidadeAba, setComunidadeAba] = useState(/** @type {string} */ (COMUNIDADES_PROFISSIONAIS[0] ?? 'Guia'))

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

  /** Sempre 5 abas (uma por comunidade), vazias se ainda não houver canal. */
  const abasComunidadesProf = useMemo(() => {
    /** @type {Record<string, Canal[]>} */
    const map = {}
    for (const c of part.profissionais) {
      const comu = String(c.comunidade_prof ?? '').trim()
      if (!comu) continue
      if (!map[comu]) map[comu] = []
      map[comu].push(c)
    }
    for (const k of Object.keys(map)) {
      map[k] = ordenarCanais(map[k])
    }
    return COMUNIDADES_PROFISSIONAIS.map((comu) => /** @type {[string, Canal[]]} */ ([comu, map[comu] ? [...map[comu]] : []]))
  }, [part.profissionais])

  const itensAbaProf = useMemo(() => {
    const f = abasComunidadesProf.find(([k]) => k === comunidadeAba)
    return f ? f[1] : /** @type {Canal[]} */ ([])
  }, [abasComunidadesProf, comunidadeAba])

  const gruposIniciais = useMemo(
    () => ({
      administracao: part.administracao.length > 0,
      profissionais: true,
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
    const label = canal.empresa_id != null ? tituloCanalEmpresaLista(canal.comunidade_prof) : canal.nome
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
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="font-bold text-[#0097b2]">{titulo}</span>
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

  const abertoProf = gruposAbertos['profissionais'] !== false

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl shadow-sm">
        {renderGrupo({ id: 'administracao', titulo: 'ADMINISTRAÇÃO', itens: part.administracao })}

        <div className="border-b border-gray-100">
          <button
            type="button"
            onClick={() => toggleGrupo('profissionais')}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="font-bold text-[#0097b2]">PROFISSIONAIS</span>
            {abertoProf ? (
              <ChevronUp size={18} aria-hidden className="shrink-0 text-[#0097b2]" />
            ) : (
              <ChevronDown size={18} aria-hidden className="shrink-0 text-[#0097b2]" />
            )}
          </button>
          {abertoProf ? (
            <div>
              <p className="bg-white px-4 pb-1 pt-0 text-xs font-bold tracking-wide text-gray-500">Comunidades</p>
              <div
                className="flex shrink-0 items-end gap-1 border-b border-gray-100 bg-white px-2 pb-0"
                role="tablist"
                aria-label="Comunidades de profissionais"
              >
                {abasComunidadesProf.map(([comu]) => {
                  const ativo = comunidadeAba === comu
                  const { Icon } = metaAbaComunidade(comu)
                  return (
                    <button
                      key={comu}
                      type="button"
                      role="tab"
                      aria-selected={ativo}
                      onClick={() => setComunidadeAba(comu)}
                      className={
                        ativo
                          ? 'mb-0 flex min-w-0 max-w-[45%] items-center gap-1.5 border-b-2 border-[#0097b2] px-2 py-2.5 text-sm font-medium text-[#0097b2] sm:max-w-none'
                          : 'mb-0.5 p-2 text-gray-400 opacity-80 hover:opacity-100'
                      }
                    >
                      {ativo ? <Icon className="h-5 w-5 shrink-0" aria-hidden /> : <Icon className="h-6 w-6 shrink-0" aria-hidden />}
                      {ativo ? <span className="truncate leading-tight">{tituloCanalEmpresaLista(comu)}</span> : null}
                    </button>
                  )
                })}
              </div>
              <div className="min-h-0 flex-1" role="tabpanel">
                {itensAbaProf.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">Nenhum canal nesta comunidade.</p>
                ) : (
                  itensAbaProf.map((canal) => (
                    <div key={canal.id} className="pl-4">
                      {renderRow(canal)}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
