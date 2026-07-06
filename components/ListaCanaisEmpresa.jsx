'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  CLASSE_AVATAR_CANAL_ADMINISTRACAO,
  CLASSE_AVATAR_CANAL_PROFISSIONAL,
  canalNomeEhFinanceiro,
  iconeCanalFinanceiro,
  iconeCanalProfissionalLista,
  rotuloCanalProfissionalLista,
  slugComunidadeProfissionalDeCanalEmpresa,
  toSlugComunidadeProf,
  tituloCanalEmpresaLista,
} from '@/lib/canaisProfissionaisListaUi'
import {
  chaveSegmentoEmpresaDeCanal,
  chaveSegmentoPorCategoriaEmpresa,
  ehCanalSegmentoEmpresaGlobal,
  iconeCanalSegmentoEmpresaLista,
  rotuloCanalSegmentoEmpresaParaEmpresa,
} from '@/lib/canaisEmpresasSegmentoUi'
import { canalExibeContagemMembros, formatarLegendaMembrosCanal } from '@/lib/canalMembrosContagem'
import { useContagemMembrosCanais } from '@/hooks/useContagemMembrosCanais'
import { buscarUltimasMensagensCanais, formatarListaHora, patchUltimaMensagemCanal } from '@/lib/canalLista'
import { contarFinanceiroNaoLidasEmpresa } from '@/lib/canaisEmpresaVisibilidade'
import { contarNaoLidasPorCanalIds } from '@/lib/canalBadge'
import { GUIA_CANAIS_BADGE_EVENT, notificarBadgeCanais } from '@/lib/canais-badge-events'
import { buscarIdCanalFinanceiroEmpresaGlobal } from '@/lib/canaisEmpresaAdm'
import { isCanalFinanceiroEmpresa } from '@/lib/canaisEmpresaSlugs'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import CanalFinanceiroListaRotulo from '@/components/CanalFinanceiroListaRotulo'
import CanalListaRow from '@/components/CanalListaRow'
import { fetchNomeUsuarioParaStory } from '@/lib/feed-autor'
import { garantirCanaisEmpresaComunidade } from '@/lib/canaisEmpresaGarantir'
import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'

/** @type {readonly string[]} */
const COMUNIDADES_PROFISSIONAIS_SLUG = ['guia', 'taxista', 'van', 'motorista_app', 'anfitriao']

/**
 * @param {{ comunidade_prof?: string | null; nome?: string | null; categoria?: string | null }} c
 */
function slugComunidadeCanalEmpresa(c) {
  return slugComunidadeProfissionalDeCanalEmpresa(c)
}

/**
 * @param {string | null | undefined} valor
 */
function toSlug(valor) {
  return toSlugComunidadeProf(valor)
}

/**
 * @param {string} slug
 */
function slugToLabel(slug) {
  const s = String(slug ?? '').trim()
  if (s === 'motorista_app') return 'Motorista de App'
  if (s === 'guia') return 'Guia'
  if (s === 'taxista') return 'Taxista'
  if (s === 'van') return 'Van'
  if (s === 'anfitriao') return 'Anfitrião'
  return s
}

/**
 * @param {string | null | undefined} nome
 */
function nomeNorm(nome) {
  return (nome ?? '').trim().toUpperCase()
}

export { tituloCanalEmpresaLista }

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
 * @param {{ nome?: string | null }} c
 * @returns {number}
 */
function prioridadeAdministracaoEmpresa(c) {
  if (ehCanalSegmentoEmpresaGlobal(c)) return 0
  if (nomeNorm(c.nome) === 'FINANCEIRO') return 1
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
    const pa = prioridadeAdministracaoEmpresa(a)
    const pb = prioridadeAdministracaoEmpresa(b)
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
  const { recursosEmpresaLiberados, loading: gateLoading, refreshGate } = useProfissionalGate()
  const [canais, setCanais] = useState(/** @type {Canal[]} */ ([]))
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState(/** @type {string | null} */ (null))
  const [empresaPlano, setEmpresaPlano] = useState(/** @type {string | null} */ (null))
  const [empresaCategoria, setEmpresaCategoria] = useState(/** @type {string | null} */ (null))
  const [admCanalIdGlobal, setAdmCanalIdGlobal] = useState(/** @type {string | null} */ (null))
  /** @type {Record<string, { preview: string, created_at: string }>} */
  const [ultimasMensagens, setUltimasMensagens] = useState({})
  /** @type {Record<string, number>} */
  const [naoLidasPorCanal, setNaoLidasPorCanal] = useState({})
  const [meuUsername, setMeuUsername] = useState(/** @type {string | null} */ (null))
  const [financeiroCanalIdGlobal, setFinanceiroCanalIdGlobal] = useState(/** @type {string | null} */ (null))
  const { featureLiberada, loading: planoLoading } = useEmpresaServicosPlano(empresaPlano, empresaId, {
    aguardarEmpresa: !empresaId,
  })
  const temCanaisComunidade = featureLiberada('canais')
  const canalProfissionalPendenteRef = useRef(/** @type {string | null} */ (null))

  /**
   * Canal de segmento da empresa + Financeiro (sem expor o canal ADM / Mensageiro).
   * @param {Canal[]} lista
   * @param {string | null} categoriaEmpresa
   * @param {string | null} financeiroIdResolvido
   */
  function garantirAdministracaoEmpresa(lista, categoriaEmpresa, financeiroIdResolvido) {
    const chaveEmp = chaveSegmentoPorCategoriaEmpresa(categoriaEmpresa)
    const segmento =
      lista.find(
        (c) =>
          ehCanalSegmentoEmpresaGlobal(c) && chaveEmp != null && chaveSegmentoEmpresaDeCanal(c) === chaveEmp,
      ) ??
      (chaveEmp
        ? {
            id: '__placeholder_segmento__',
            nome: chaveEmp,
            tipo_publico: 'empresa',
            categoria: categoriaEmpresa,
            comunidade_prof: null,
            empresa_id: null,
            ordem_tipo: 'fixo',
            ordem_posicao: 1,
            ultima_mensagem_em: null,
          }
        : null)
    const fin =
      lista.find((c) => nomeNorm(c.nome) === 'FINANCEIRO') ??
      (financeiroIdResolvido
        ? {
            id: financeiroIdResolvido,
            nome: 'Financeiro',
            tipo_publico: 'empresa',
            categoria: null,
            comunidade_prof: null,
            empresa_id: null,
            ordem_tipo: 'fixo',
            ordem_posicao: 2,
            ultima_mensagem_em: null,
          }
        : null)
    /** @type {Canal[]} */
    const out = []
    if (segmento) out.push(segmento)
    out.push(
      fin ?? {
        id: '__placeholder_financeiro__',
        nome: 'Financeiro',
        tipo_publico: 'empresa',
        categoria: null,
        comunidade_prof: null,
        empresa_id: null,
        ordem_tipo: 'fixo',
        ordem_posicao: 2,
        ultima_mensagem_em: null,
      },
    )
    return out
  }

  /**
   * Garante as 5 comunidades em PROFISSIONAIS (Empresa).
   * @param {Canal[]} lista
   */
  function garantirComunidadesProfissionais(lista) {
    /** @type {Map<string, Canal>} */
    const porComunidade = new Map()
    for (const c of lista) {
      const k = slugComunidadeCanalEmpresa(c)
      if (!k) continue
      if (!porComunidade.has(k)) porComunidade.set(k, c)
    }

    return COMUNIDADES_PROFISSIONAIS_SLUG.map((slug) => {
      const real = porComunidade.get(slug)
      return (
        real ?? {
          id: `__placeholder_prof_${slug}__`,
          nome: slugToLabel(slug),
          tipo_publico: 'empresa',
          categoria: null,
          comunidade_prof: slugToLabel(slug),
          empresa_id: empresaId,
          ordem_tipo: 'rotativo',
          ordem_posicao: null,
          ultima_mensagem_em: null,
        }
      )
    })
  }

  const part = useMemo(() => {
    const administracao = ordenarCanaisAdministracaoEmpresa(
      canais.filter(
        (c) =>
          c.tipo_publico === 'empresa' &&
          c.empresa_id == null &&
          (nomeNorm(c.nome) === 'FINANCEIRO' || ehCanalSegmentoEmpresaGlobal(c)),
      ),
    )
    const profissionais = canais
      .filter((c) => c.tipo_publico === 'empresa' && empresaId && String(c.empresa_id ?? '') === String(empresaId))
      .filter((c) => {
        const slug = slugComunidadeCanalEmpresa(c)
        return Boolean(slug) && COMUNIDADES_PROFISSIONAIS_SLUG.includes(slug)
      })
    return {
      administracao: garantirAdministracaoEmpresa(administracao, empresaCategoria, financeiroCanalIdGlobal),
      profissionais: garantirComunidadesProfissionais(profissionais),
    }
  }, [canais, empresaId, empresaCategoria, financeiroCanalIdGlobal])

  const administracaoExibicao = useMemo(() => {
    if (temCanaisComunidade) return part.administracao
    return part.administracao.filter((c) => isCanalFinanceiroEmpresa(c.nome))
  }, [part.administracao, temCanaisComunidade])

  const profissionaisExibicao = useMemo(() => {
    if (!temCanaisComunidade) return []
    return ordenarCanais(part.profissionais)
  }, [part.profissionais, temCanaisComunidade])

  const canaisParaMembros = useMemo(
    () => [...part.administracao, ...part.profissionais],
    [part],
  )

  const membrosPorCanal = useContagemMembrosCanais(canaisParaMembros)

  const gruposIniciais = useMemo(
    () => ({
      administracao: false,
      profissionais: false,
    }),
    [],
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

  const recarregarContagens = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return

    const ids = canais.map((c) => c.id).filter((id) => !String(id).startsWith('__placeholder'))
    if (ids.length === 0) {
      setNaoLidasPorCanal({})
      return
    }

    const contagens = await contarNaoLidasPorCanalIds(supabase, uid, ids)
    const fin = await contarFinanceiroNaoLidasEmpresa(supabase, uid)
    for (const c of canais) {
      if (isCanalFinanceiroEmpresa(c.nome)) {
        contagens[c.id] = fin
      }
    }
    setNaoLidasPorCanal(contagens)
  }, [canais])

  useEffect(() => {
    const onBadge = () => {
      void recarregarContagens()
    }
    window.addEventListener(GUIA_CANAIS_BADGE_EVENT, onBadge)
    return () => window.removeEventListener(GUIA_CANAIS_BADGE_EVENT, onBadge)
  }, [recarregarContagens])

  const contagensTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))

  const agendarRecarregarContagens = useCallback(() => {
    if (contagensTimerRef.current) clearTimeout(contagensTimerRef.current)
    contagensTimerRef.current = setTimeout(() => {
      contagensTimerRef.current = null
      void recarregarContagens()
    }, 400)
  }, [recarregarContagens])

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
      const { data: emp } = await supabase.from('empresas').select('id, categoria, plano').eq('usuario_id', uid).maybeSingle()
      const empId = emp?.id != null ? String(emp.id) : null
      const catEmp = emp?.categoria != null ? String(emp.categoria) : null
      const planoEmp = emp?.plano != null ? String(emp.plano) : 'gratuito'
      setEmpresaId(empId)
      setEmpresaPlano(planoEmp)
      setEmpresaCategoria(catEmp)

      if (empId) {
        await garantirCanaisEmpresaComunidade(supabase, empId)
      }

      const chaveEmp = chaveSegmentoPorCategoriaEmpresa(catEmp)

      const [{ data, error }, finCanalId] = await Promise.all([
        supabase
          .from('canais')
          .select('id, nome, tipo_publico, categoria, comunidade_prof, empresa_id, ultima_mensagem_em, ordem_tipo, ordem_posicao')
          .eq('tipo_publico', 'empresa')
          .eq('ativo', true),
        buscarIdCanalFinanceiroEmpresaGlobal(supabase),
      ])

      setFinanceiroCanalIdGlobal(finCanalId)

      if (error) throw error
      const lista = /** @type {Canal[]} */ (data ?? [])
      const admGlobal = lista.find((c) => c.empresa_id == null && nomeNorm(c.nome) === 'ADM')
      setAdmCanalIdGlobal(admGlobal?.id != null ? String(admGlobal.id) : null)

      const filtrada = lista.filter((c) => {
        if (c.empresa_id == null) {
          if (nomeNorm(c.nome) === 'FINANCEIRO') return true
          if (ehCanalSegmentoEmpresaGlobal(c) && chaveEmp) {
            return chaveSegmentoEmpresaDeCanal(c) === chaveEmp
          }
          return false
        }
        return empId != null && String(c.empresa_id ?? '') === String(empId)
      })
      const ordenados = ordenarCanais(filtrada)
      setCanais(ordenados)

      const pendenteSlug = canalProfissionalPendenteRef.current
      if (pendenteSlug && empId) {
        const real = ordenados.find(
          (c) =>
            String(c.empresa_id ?? '') === String(empId) &&
            slugComunidadeCanalEmpresa(c) === pendenteSlug &&
            !String(c.id ?? '').startsWith('__placeholder'),
        )
        if (real) {
          canalProfissionalPendenteRef.current = null
          onSelectCanal(real)
        }
      }

      const ids = ordenados.map((c) => c.id).filter((id) => !String(id).startsWith('__placeholder'))
      const [ultimas, contagens, fin, username] = await Promise.all([
        buscarUltimasMensagensCanais(supabase, ids),
        contarNaoLidasPorCanalIds(supabase, uid, ids),
        contarFinanceiroNaoLidasEmpresa(supabase, uid),
        fetchNomeUsuarioParaStory(supabase, uid),
      ])
      setMeuUsername(username)
      setUltimasMensagens(ultimas)
      for (const c of ordenados) {
        if (isCanalFinanceiroEmpresa(c.nome)) {
          contagens[c.id] = fin
        }
      }
      setNaoLidasPorCanal(contagens)
    } catch (e) {
      console.error('Erro ao carregar canais empresa:', e)
    } finally {
      setLoading(false)
    }
  }, [onSelectCanal])

  useEffect(() => {
    if (!temCanaisComunidade) return
    if (!empresaId || planoLoading) return
    void (async () => {
      await garantirCanaisEmpresaComunidade(supabase, empresaId)
      await carregar()
    })()
  }, [carregar, empresaId, planoLoading, temCanaisComunidade])

  useEffect(() => {
    if (planoLoading || !temCanaisComunidade) return
    setGruposAbertos((prev) => ({ ...prev, profissionais: true }))
  }, [planoLoading, temCanaisComunidade])

  useEffect(() => {
    void refreshGate()
  }, [refreshGate])

  useEffect(() => {
    const onRef = () => void carregar()
    window.addEventListener('empresa-gate-refresh', onRef)
    window.addEventListener('perfil-atualizado', onRef)
    return () => {
      window.removeEventListener('empresa-gate-refresh', onRef)
      window.removeEventListener('perfil-atualizado', onRef)
    }
  }, [carregar])

  useEffect(() => {
    if (planoLoading || gateLoading) return
    if (!recursosEmpresaLiberados) return
    if (temCanaisComunidade) return
    setGruposAbertos((prev) => ({ ...prev, administracao: true }))
  }, [gateLoading, planoLoading, recursosEmpresaLiberados, temCanaisComunidade])

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
        (payload) => {
          const novo = payload.new
          if (!novo?.id || String(canalId).startsWith('__placeholder')) return
          notificarBadgeCanais()
          setUltimasMensagens((prev) => patchUltimaMensagemCanal(prev, canalId, novo))
          agendarRecarregarContagens()
        },
      )
    }
    void ch.subscribe()

    return () => {
      if (contagensTimerRef.current) clearTimeout(contagensTimerRef.current)
      void supabase.removeChannel(ch)
    }
  }, [idsMonitor, agendarRecarregarContagens])

  /**
   * Não lidas do canal de segmento incluem mensagens legadas no canal ADM global.
   * @param {Canal} canal
   */
  const naoLidasExibidas = (canal) => {
    let n = naoLidasPorCanal[canal.id] ?? 0
    if (ehCanalSegmentoEmpresaGlobal(canal) && admCanalIdGlobal) {
      n += naoLidasPorCanal[admCanalIdGlobal] ?? 0
    }
    return n
  }

  /**
   * @param {Canal} canal
   */
  const getIcon = (canal) => {
    if (ehCanalSegmentoEmpresaGlobal(canal)) return iconeCanalSegmentoEmpresaLista(canal)
    if (canalNomeEhFinanceiro(canal.nome)) return iconeCanalFinanceiro()
    return iconeCanalProfissionalLista(canal)
  }

  const legendaMembros = (canal) => {
    if (!canalExibeContagemMembros(canal)) return null
    const n = membrosPorCanal[canal.id]
    if (n === undefined) return null
    return formatarLegendaMembrosCanal(n)
  }

  /**
   * @param {Canal} canal
   * @param {{ pastaProfissionais?: boolean; pastaAdministracao?: boolean }} [opts]
   */
  function renderRow(canal, opts = {}) {
    const pastaAdministracao = opts.pastaAdministracao === true
    const ehProfissional =
      !pastaAdministracao &&
      (opts.pastaProfissionais ||
        slugComunidadeCanalEmpresa(canal) !== '' ||
        (canal.comunidade_prof != null && String(canal.comunidade_prof).trim() !== ''))
    const ehSegmentoAdm = canal.empresa_id == null && ehCanalSegmentoEmpresaGlobal(canal)
    const ehFinanceiro = canal.empresa_id == null && isCanalFinanceiroEmpresa(canal.nome)
    const Icon = ehProfissional ? iconeCanalProfissionalLista(canal) : getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    const isPlaceholder = String(canal.id ?? '').startsWith('__placeholder_')
    const financeiroBloqueado = ehFinanceiro && !recursosEmpresaLiberados && !gateLoading
    const financeiroSemCanal = ehFinanceiro && isPlaceholder && !financeiroCanalIdGlobal
    const profissionalPlaceholder = isPlaceholder && ehProfissional && temCanaisComunidade
    const rowDisabled =
      isPlaceholder &&
      !(ehFinanceiro && recursosEmpresaLiberados && financeiroCanalIdGlobal) &&
      !profissionalPlaceholder
    const label = ehFinanceiro ? (
      <CanalFinanceiroListaRotulo username={meuUsername} />
    ) : ehSegmentoAdm ? (
      rotuloCanalSegmentoEmpresaParaEmpresa(canal)
    ) : ehProfissional ? (
      rotuloCanalProfissionalLista(canal)
    ) : (
      canal.nome
    )
    const ultima = ultimasMensagens[canal.id]
    const horaIso = canal.ultima_mensagem_em ?? ultima?.created_at ?? null
    const naoLidas = naoLidasExibidas(canal)

    return (
      <CanalListaRow
        key={canal.id}
        label={label}
        preview={ehProfissional ? null : ultima?.preview || (horaIso ? ' ' : null)}
        hora={ehProfissional ? null : formatarListaHora(horaIso)}
        somenteTitulo={
          ehFinanceiro ||
          ehProfissional ||
          ehSegmentoAdm ||
          (canal.empresa_id == null && canalExibeContagemMembros(canal))
        }
        subtitulo={
          ehFinanceiro
            ? financeiroBloqueado
              ? 'Aguardando verificação do cadastro'
              : financeiroSemCanal
                ? 'Canal em configuração — contacte o suporte'
                : null
            : ehProfissional || canalExibeContagemMembros(canal)
              ? legendaMembros(canal)
              : null
        }
        naoLidas={naoLidas}
        active={isActive}
        disabled={rowDisabled}
        onClick={() => {
          if (rowDisabled) return
          if (profissionalPlaceholder) {
            const slug = slugComunidadeCanalEmpresa(canal)
            if (!empresaId || !slug) return
            canalProfissionalPendenteRef.current = slug
            void (async () => {
              const ok = await garantirCanaisEmpresaComunidade(supabase, empresaId)
              await carregar()
              if (!ok) {
                window.alert(
                  'Não foi possível preparar este canal. Tente novamente ou contacte o suporte.',
                )
              }
            })()
            return
          }
          if (ehFinanceiro && financeiroBloqueado) {
            window.alert(
              'O canal financeiro é liberado após a verificação dos seus documentos. Menu → USUÁRIO → Anexar documentos.',
            )
            return
          }
          onSelectCanal(canal)
        }}
        avatar={
          <div
            className={
              pastaAdministracao
                ? CLASSE_AVATAR_CANAL_ADMINISTRACAO
                : ehProfissional
                  ? CLASSE_AVATAR_CANAL_PROFISSIONAL
                  : `flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${
                      isActive ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-500'
                    }`
            }
          >
            <Icon size={22} aria-hidden />
          </div>
        }
      />
    )
  }

  const toggleGrupo = (id) => {
    setGruposAbertos((prev) => {
      const aberto = prev[id] === true
      return { ...prev, [id]: !aberto }
    })
  }

  /**
   * @param {{ id: string; titulo: string; itens: Canal[]; forcarVazio?: boolean; mensagemVazio?: string }} args
   */
  function renderGrupo({ id, titulo, itens, forcarVazio, mensagemVazio }) {
    if (itens.length === 0 && !forcarVazio) return null
    const aberto = gruposAbertos[id] === true
    const totalPasta = itens.reduce((s, c) => s + naoLidasExibidas(c), 0)
    return (
      <div className="border-b border-gray-100">
        <button
          type="button"
          onClick={() => toggleGrupo(id)}
          className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-base"
        >
          <span className="font-bold leading-snug text-[#0097b2]">{titulo}</span>
          <span className="flex shrink-0 items-center gap-2">
            {!aberto ? <CanalNaoLidasBadge count={totalPasta} /> : null}
            {aberto ? (
              <ChevronUp size={18} aria-hidden className="text-[#0097b2]" />
            ) : (
              <ChevronDown size={18} aria-hidden className="text-[#0097b2]" />
            )}
          </span>
        </button>
        {aberto ? (
          itens.length === 0 && mensagemVazio ? (
            <p className="px-4 pb-4 pl-8 text-sm text-gray-500">{mensagemVazio}</p>
          ) : (
            <div>
              {itens.map((canal) => (
                <div key={canal.id} className="pl-2">
                  {renderRow(canal, {
                    pastaProfissionais: id === 'profissionais',
                    pastaAdministracao: id === 'administracao',
                  })}
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    )
  }

  if (loading || planoLoading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {renderGrupo({ id: 'administracao', titulo: 'ADMINISTRAÇÃO', itens: administracaoExibicao })}
        {temCanaisComunidade
          ? renderGrupo({
              id: 'profissionais',
              titulo: 'PROFISSIONAIS',
              itens: profissionaisExibicao,
            })
          : null}
      </div>
    </div>
  )
}
