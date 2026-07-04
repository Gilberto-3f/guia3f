'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MessageCircle, Building2, Crown, ChevronUp, ChevronDown } from 'lucide-react'
import {
  CLASSE_AVATAR_CANAL_ADMINISTRACAO,
  CLASSE_AVATAR_CANAL_PROFISSIONAL,
  canalNomeEhFinanceiro,
  iconeCanalFinanceiro,
  iconeCanalProfissionalLista,
  rotuloCanalProfissionalLista,
} from '@/lib/canaisProfissionaisListaUi'
import { canalExibeContagemMembros, formatarLegendaMembrosCanal } from '@/lib/canalMembrosContagem'
import { useContagemMembrosCanais } from '@/hooks/useContagemMembrosCanais'
import {
  CHAVES_SEGMENTO_EMPRESA,
  CLASSE_AVATAR_CANAL_EMPRESA_SEGMENTO,
  chaveSegmentoEmpresaDeCanal,
  iconeCanalSegmentoEmpresaLista,
  rotuloCanalSegmentoEmpresaLista,
} from '@/lib/canaisEmpresasSegmentoUi'
import {
  excluirCanalMensageiroVisaoAdm,
  rotuloNomeCanalAdministracao,
  TITULO_PASTA_ADMINISTRADORES_APP,
} from '@/lib/rotulosCanaisAdministracao'
import { buscarUltimasMensagensCanais, formatarListaHora, patchUltimaMensagemCanal } from '@/lib/canalLista'
import { contarNaoLidasPorCanalIds } from '@/lib/canalBadge'
import { ehCanalInboxMensageiroAdm, obterIdCanalInboxMensageiroAdm } from '@/lib/canaisAdminVisibilidade'
import { particionarVisaoAdminTodos } from '@/lib/canaisAdminParticao'
import { GUIA_CANAIS_BADGE_EVENT, notificarBadgeCanais } from '@/lib/canais-badge-events'
import CanalListaRow from '@/components/CanalListaRow'
import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'

/** @type {readonly string[]} */
const CATEGORIAS_PROFISSIONAIS = ['motorista_app', 'van', 'taxista', 'guia', 'anfitriao']

/** Valores legados (categoria) e rótulos atuais (cadastro / `empresa_categoria`). */
const CATEGORIAS_EMPRESAS = ['gastronomia', 'lojas', 'passeios', 'hospedagem']
const CATEGORIAS_EMPRESAS_ROTULO = ['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem', 'Serviços Locais']

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
 * Alguns canais “legados” usam `tipo_publico='empresa'`, mas na prática são categorias de PROFISSIONAIS
 * (ex.: guia, taxista, van). Eles não devem aparecer na pasta EMPRESAS.
 * @param {Canal} c
 */
function canalEhProfissional(c) {
  const cat = (c.categoria ?? '').trim().toLowerCase()
  if (cat && CATEGORIAS_PROFISSIONAIS.includes(cat)) return true
  const nome = (c.nome ?? '').trim().toLowerCase()
  return CATEGORIAS_PROFISSIONAIS.includes(nome)
}

/**
 * Normaliza categoria profissional para deduplicar (ex.: "Taxistas" e "taxista").
 * @param {Canal} c
 * @returns {string | null}
 */
function chaveProfissional(c) {
  const cat = (c.categoria ?? '').trim().toLowerCase()
  if (cat && CATEGORIAS_PROFISSIONAIS.includes(cat)) return cat

  const rawNome = (c.nome ?? '').trim().toLowerCase()
  if (!rawNome) return null

  // Remover acentos para comparar "anfitriões" vs "anfitrioes".
  const nome = rawNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  if (nome === 'taxistas') return 'taxista'
  if (nome === 'guias') return 'guia'
  if (nome === 'vans') return 'van'
  if (nome === 'anfitrioes') return 'anfitriao'
  if (nome === 'motoristas_app' || nome === 'motoristas app') return 'motorista_app'

  if (CATEGORIAS_PROFISSIONAIS.includes(nome)) return nome
  return null
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
  // Evita duplicar "Canal ADM" quando há canais equivalentes (ex.: ADM e MENSAGEIRO).
  // Mantém o canal ADM quando existir e oculta o "MENSAGEIRO" (mesma função na UI).
  const temAdm = lista.some((c) => nomeNorm(c.nome) === 'ADM')
  let filtrada = temAdm ? lista.filter((c) => nomeNorm(c.nome) !== 'MENSAGEIRO') : lista

  // Um único Canal Financeiro na pasta ADM (profissional tem prioridade sobre empresa).
  const financeiros = filtrada.filter((c) => nomeNorm(c.nome) === 'FINANCEIRO')
  if (financeiros.length > 1) {
    const keeper =
      financeiros.find((c) => c.tipo_publico === 'profissional') ?? financeiros[0]
    filtrada = filtrada.filter((c) => nomeNorm(c.nome) !== 'FINANCEIRO' || c.id === keeper.id)
  }

  const fixos = filtrada.filter((c) => c.ordem_tipo === 'fixo')
  const rot = filtrada.filter((c) => c.ordem_tipo !== 'fixo')
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
        (c) => c.tipo_publico === 'empresa' && nomeNorm(c.nome) !== 'ADM' && canalEMSegmentoNegocio(c) && !canalEhProfissional(c),
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
  /** @type {Record<string, { preview: string, created_at: string }>} */
  const [ultimasMensagens, setUltimasMensagens] = useState({})
  /** @type {Record<string, number>} */
  const [naoLidasPorCanal, setNaoLidasPorCanal] = useState({})

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

  const canaisParaMembros = useMemo(() => {
    const list = [...(part.profissionais ?? []), ...(part.empresas ?? [])]
    for (const c of adminUnificado) {
      if (canalExibeContagemMembros(c)) list.push(c)
    }
    return list
  }, [part, adminUnificado])

  const membrosPorCanal = useContagemMembrosCanais(canaisParaMembros)

  const gruposIniciais = useMemo(
    () => ({
      administracaoUnificada: false,
      profissionais: false,
      empresas: false,
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

  /** Admin: badge só no inbox Mensageiro ADM; broadcast não notifica. */
  const resolverIdsContagemAdmin = useCallback(async () => {
    const inboxNaLista = canais.filter((c) => ehCanalInboxMensageiroAdm(c)).map((c) => c.id)
    if (inboxNaLista.length > 0) return inboxNaLista
    const inboxId = await obterIdCanalInboxMensageiroAdm(supabase)
    return inboxId ? [inboxId] : []
  }, [canais])

  const recarregarContagens = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return

    const todosIds = canais.map((c) => c.id).filter((id) => !id.startsWith('__placeholder'))
    const ids =
      agruparPorTipo || tipoPublico === 'admin'
        ? await resolverIdsContagemAdmin()
        : todosIds

    if (ids.length === 0 && (agruparPorTipo || tipoPublico === 'admin')) {
      setNaoLidasPorCanal({})
      return
    }

    const idsContagem = agruparPorTipo || tipoPublico === 'admin' ? ids : todosIds
    const contagens = await contarNaoLidasPorCanalIds(supabase, uid, idsContagem)
    setNaoLidasPorCanal(contagens)
  }, [canais, agruparPorTipo, tipoPublico, resolverIdsContagemAdmin])

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

  useEffect(() => {
    const carregarCanais = async () => {
      setLoading(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const uid = session?.user?.id

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

        const ordenados = [...fixos, ...rotativos]
        setCanais(ordenados)
        const idsBrutos = ordenados.map((c) => c.id).filter((id) => !id.startsWith('__placeholder'))
        let idsContagem = idsBrutos
        if (agruparPorTipo || tipoPublico === 'admin') {
          const inboxNaLista = ordenados.filter((c) => ehCanalInboxMensageiroAdm(c)).map((c) => c.id)
          const inboxId =
            inboxNaLista.length > 0 ? inboxNaLista[0] : await obterIdCanalInboxMensageiroAdm(supabase)
          idsContagem = inboxId ? [inboxId] : []
        }
        const [ultimas, contagens] = await Promise.all([
          buscarUltimasMensagensCanais(supabase, idsBrutos),
          uid
            ? contarNaoLidasPorCanalIds(supabase, uid, idsContagem)
            : Promise.resolve(/** @type {Record<string, number>} */ ({})),
        ])
        setUltimasMensagens(ultimas)
        if (uid) setNaoLidasPorCanal(contagens)
      } catch (e) {
        console.error('Erro ao carregar canais:', e)
      } finally {
        setLoading(false)
      }
    }

    void carregarCanais()
  }, [tipoPublico, paisFiltro])

  const idsMonitor = useMemo(() => canais.map((c) => c.id).filter((id) => !id.startsWith('__placeholder')), [canais])

  useEffect(() => {
    if (idsMonitor.length === 0) return

    const ch = supabase.channel('lista-canais-adm-mensagens')
    for (const canalId of idsMonitor) {
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_canal', filter: `canal_id=eq.${canalId}` },
        (payload) => {
          const novo = payload.new
          if (!novo?.id) return
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
   * @param {Canal} canal
   */
  const getIcon = (canal) => {
    const n = nomeNorm(canal.nome)
    if (n === 'ADM') return Crown
    if (canalNomeEhFinanceiro(canal.nome)) return iconeCanalFinanceiro()
    if (canal.tipo_publico === 'empresa') return Building2
    return MessageCircle
  }

  const legendaMembros = (canal) => {
    if (!canalExibeContagemMembros(canal)) return null
    const n = membrosPorCanal[canal.id]
    if (n === undefined) return null
    return formatarLegendaMembrosCanal(n)
  }

  const toggleGrupo = (grupo) => {
    setGruposAbertos((prev) => {
      const aberto = prev[grupo] === true
      return { ...prev, [grupo]: !aberto }
    })
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  /**
   * @param {Canal} canal
   * @param {{ blocoAdministracao?: boolean; pastaProfissionais?: boolean; pastaEmpresas?: boolean }} [opts]
   */
  function renderRow(canal, opts = {}) {
    const ehProfissional = opts.pastaProfissionais === true
    const ehEmpresas = opts.pastaEmpresas === true
    const estiloSegmento = ehProfissional || ehEmpresas
    const Icon = ehProfissional
      ? iconeCanalProfissionalLista(canal)
      : ehEmpresas
        ? iconeCanalSegmentoEmpresaLista(canal)
        : getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    const label = opts.blocoAdministracao
      ? rotuloNomeCanalAdministracao(canal.nome)
      : ehProfissional
        ? rotuloCanalProfissionalLista(canal)
        : ehEmpresas
          ? rotuloCanalSegmentoEmpresaLista(canal)
          : canal.nome
    const ultima = ultimasMensagens[canal.id]
    const horaIso = canal.ultima_mensagem_em ?? ultima?.created_at ?? null
    const naoLidas = naoLidasPorCanal[canal.id] ?? 0

    return (
      <CanalListaRow
        key={canal.id}
        label={label}
        preview={estiloSegmento ? null : ultima?.preview || (horaIso ? ' ' : null)}
        hora={estiloSegmento ? null : formatarListaHora(horaIso)}
        somenteTitulo={estiloSegmento}
        subtitulo={
          estiloSegmento || canalExibeContagemMembros(canal) ? legendaMembros(canal) : null
        }
        naoLidas={naoLidas}
        active={isActive}
        onClick={() => onSelectCanal(canal)}
        avatar={
          <div
            className={
              opts.blocoAdministracao
                ? CLASSE_AVATAR_CANAL_ADMINISTRACAO
                : estiloSegmento
                  ? ehEmpresas
                    ? CLASSE_AVATAR_CANAL_EMPRESA_SEGMENTO
                    : CLASSE_AVATAR_CANAL_PROFISSIONAL
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

  /**
   * @param {{ id: string; titulo: string; itens: Canal[]; administracao?: boolean; pastaProfissionais?: boolean; pastaEmpresas?: boolean }} args
   */
  function renderGrupoChevron({ id, titulo, itens, administracao, pastaProfissionais, pastaEmpresas }) {
    if (itens.length === 0) return null
    const aberto = gruposAbertos[id] === true
    const adm = administracao === true
    const itensRender =
      pastaEmpresas === true
        ? [...itens].sort((a, b) => {
            const ia = CHAVES_SEGMENTO_EMPRESA.indexOf(chaveSegmentoEmpresaDeCanal(a) ?? '')
            const ib = CHAVES_SEGMENTO_EMPRESA.indexOf(chaveSegmentoEmpresaDeCanal(b) ?? '')
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
          })
        : itens
    const totalPasta = itensRender.reduce((s, c) => s + (naoLidasPorCanal[c.id] ?? 0), 0)
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
          <div>
            {itensRender.map((canal) => (
              <div key={canal.id} className="pl-2">
                {renderRow(canal, {
                  blocoAdministracao: adm,
                  pastaProfissionais: pastaProfissionais === true,
                  pastaEmpresas: pastaEmpresas === true,
                })}
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
    // No "Mensageiro ADM" (agruparPorTipo) e no perfil admin, nada deve aparecer fora das pastas.
    const mostrarOutros = !(agruparPorTipo || tipoPublico === 'admin')
    const outros = mostrarOutros
      ? canais.filter((c) => {
          if (particionIds.has(c.id)) return false
          if (c.tipo_publico === 'empresa' && c.empresa_id == null && nomeNorm(c.nome) === 'ADM') return false
          if (agruparPorTipo && excluirCanalMensageiroVisaoAdm(c)) return false
          // Visão "Mensageiro ADM": canais legados de PROFISSIONAIS não devem aparecer como linhas soltas
          // (eles já existem na pasta PROFISSIONAIS).
          if (agruparPorTipo && (canalEhProfissional(c) || chaveProfissional(c) != null)) return false
          return true
        })
      : []

    return (
      <div className="bg-white pb-4">
        {renderGrupoChevron({
          id: 'administracaoUnificada',
          titulo: TITULO_PASTA_ADMINISTRADORES_APP,
          itens: adminUnificado,
          administracao: true,
        })}
        {renderGrupoChevron({ id: 'profissionais', titulo: 'PROFISSIONAIS', itens: part.profissionais, pastaProfissionais: true })}
        {renderGrupoChevron({ id: 'empresas', titulo: 'EMPRESAS', itens: part.empresas, pastaEmpresas: true })}
        {mostrarOutros ? outros.map((canal) => renderRow(canal)) : null}
      </div>
    )
  }

  return <div className="overflow-hidden bg-white">{canais.map((canal) => renderRow(canal))}</div>
}
