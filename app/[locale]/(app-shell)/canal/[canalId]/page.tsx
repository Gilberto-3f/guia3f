'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ChevronLeft, MoreVertical } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import BandeiraPais from '@/components/BandeiraPais'
import CanalHeaderTitulo from '@/components/canal/CanalHeaderTitulo'
import CanalAbasPais from '@/components/CanalAbasPais'
import CanalFinanceiroLista from '@/components/CanalFinanceiroLista'
import CanalFinanceiroListaRotulo from '@/components/CanalFinanceiroListaRotulo'
import { fetchNomeUsuarioParaStory } from '@/lib/feed-autor'
import { tituloCanalEmpresaLista } from '@/components/ListaCanaisEmpresa'
import { rotuloCanalListaProfissional } from '@/lib/canaisProfissionaisListaUi'
import {
  enviarMarcacaoLeituraKeepalive,
  marcarCanalComoLido,
  marcarCanaisLidosKeepalive,
} from '@/lib/canalBadge'
import { aquecerCacheImagensMensagensCanal } from '@/lib/canalAnexoUrl'
import { listarMensagensCanalRecentes } from '@/lib/canalMensagensFetch'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { canalMensageiroAdmSemAbasPais } from '@/lib/rotulosCanaisAdministracao'
import {
  ehCanalSegmentoEmpresaGlobal,
  rotuloCanalSegmentoEmpresaParaEmpresa,
  rotuloCanalSegmentoPorCategoriaEmpresa,
} from '@/lib/canaisEmpresasSegmentoUi'
import {
  buscarSlugsCategoriasProfissional,
  canalEmpresaVisivelParaProfissional,
  canalGlobalProfissionalVisivel,
  marcarFinanceiroLidoProfissional,
} from '@/lib/canaisProfissionalVisibilidade'
import { marcarFinanceiroLidoEmpresa } from '@/lib/canaisEmpresaVisibilidade'
import { isCanalAdmProfissionalGlobal, isCanalFinanceiroProfissional } from '@/lib/canaisProfissionalSlugs'
import type { CanalAdmInboxConfig } from '@/lib/canaisProfissionalAdm'
import {
  isCanalAdmEmpresaGlobal,
  isCanalFinanceiroEmpresa,
} from '@/lib/canaisEmpresaSlugs'
import {
  buscarIdCanalAdmEmpresaGlobal,
  resolverInboxCanalAdmEmpresa,
  type CanalAdmEmpresaInboxConfig,
} from '@/lib/canaisEmpresaAdm'

const CanalDrawer = dynamic(() => import('@/components/canal/CanalDrawer'), { ssr: false })

const CanalMensagens = dynamic(() => import('@/components/CanalMensagens'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center">
      <div className="animate-pulse text-sm text-gray-400">Carregando mensagens...</div>
    </div>
  ),
})

type TipoUsuario = 'turista' | 'profissional' | 'empresa' | 'admin' | null

type EmpresaCanalEmbed = {
  nome_fantasia: string | null
  cidade: string | null
  foto_url: string | null
}

type CanalRow = {
  id: string
  nome: string
  tipo_publico: string | null
  comunidade_prof: string | null
  categoria: string | null
  empresa_id: string | null
  empresas?: EmpresaCanalEmbed | null
}

export default function CanalDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const canalId = params?.canalId != null ? String(params.canalId) : ''

  const { modoAtivo, perfilSimulado, podeInteragir } = useModoApresentacao()
  const { recursosProfissionaisLiberados } = useProfissionalGate()
  const [userTipo, setUserTipo] = useState<TipoUsuario>(null)
  const [authPronto, setAuthPronto] = useState(false)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [carregandoCanal, setCarregandoCanal] = useState(true)
  const [canal, setCanal] = useState<CanalRow | null>(null)
  const [canalMissing, setCanalMissing] = useState(false)
  const [abaPais, setAbaPais] = useState('geral')
  const [inboxCanalAdm, setInboxCanalAdm] = useState<CanalAdmInboxConfig | CanalAdmEmpresaInboxConfig | null>(null)
  const [empresaCategoria, setEmpresaCategoria] = useState<string | null>(null)
  const [meuUsername, setMeuUsername] = useState<string | null>(null)
  const [drawerCanalAberto, setDrawerCanalAberto] = useState(false)
  const [destaqueMensagemId, setDestaqueMensagemId] = useState<string | null>(null)

  const paises = ['BR', 'AR', 'PY', 'geral']
  const paisesEmpresaProfissionais = ['BR', 'PY', 'AR']

  const userTipoEfetivo = useMemo((): TipoUsuario => {
    if (modoAtivo && perfilSimulado) {
      if (perfilSimulado.tipo === 'turista') return 'turista'
      if (perfilSimulado.tipo === 'profissional') return 'profissional'
      if (perfilSimulado.tipo === 'empresa') return 'empresa'
    }
    return userTipo
  }, [modoAtivo, perfilSimulado, userTipo])

  const financeUid = useMemo(() => usuarioId, [usuarioId])
  const accessTokenRef = useRef<string | null>(null)

  /** Tipo efetivo a partir do role da BD (sem depender do setState de `userTipo`). */
  const tipoEfetivoDeRole = useCallback(
    (role: string | null | undefined): TipoUsuario => {
      if (modoAtivo && perfilSimulado) {
        if (perfilSimulado.tipo === 'turista') return 'turista'
        if (perfilSimulado.tipo === 'profissional') return 'profissional'
        if (perfilSimulado.tipo === 'empresa') return 'empresa'
      }
      if (role === 'turista') return 'turista'
      if (role === 'profissional') return 'profissional'
      if (role === 'empresa') return 'empresa'
      if (role === 'admin') return 'admin'
      return null
    },
    [modoAtivo, perfilSimulado],
  )

  useEffect(() => {
    let cancelado = false

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      if (cancelado) return

      const uid = session.user.id
      accessTokenRef.current = session.access_token
      setUsuarioId(uid)
      void fetchNomeUsuarioParaStory(supabase, uid).then((nu) => {
        if (!cancelado) setMeuUsername(nu)
      })

      if (!canalId) {
        setCanal(null)
        setCanalMissing(true)
        setCarregandoCanal(false)
        const { data: userData } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
        if (cancelado) return
        const role = userData?.role != null ? String(userData.role) : null
        if (role === 'turista') setUserTipo('turista')
        else if (role === 'profissional') setUserTipo('profissional')
        else if (role === 'empresa') setUserTipo('empresa')
        else if (role === 'admin') setUserTipo('admin')
        else setUserTipo(null)
        setAuthPronto(true)
        return
      }

      setCarregandoCanal(true)
      setCanalMissing(false)
      setInboxCanalAdm(null)

      const rolePromise = supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
      const canalPromise = supabase
        .from('canais')
        .select(
          `
          id, nome, tipo_publico, comunidade_prof, categoria, empresa_id,
          empresas:empresa_id ( nome_fantasia, cidade, foto_url )
          `,
        )
        .eq('id', canalId)
        .maybeSingle()

      const [{ data: userData }, canalRes] = await Promise.all([rolePromise, canalPromise])
      if (cancelado) return

      const role = userData?.role != null ? String(userData.role) : null
      if (role === 'turista') setUserTipo('turista')
      else if (role === 'profissional') setUserTipo('profissional')
      else if (role === 'empresa') setUserTipo('empresa')
      else if (role === 'admin') setUserTipo('admin')
      else setUserTipo(null)

      setAuthPronto(true)

      const tipoLocal = tipoEfetivoDeRole(role)
      if (tipoLocal === 'turista') {
        setCarregandoCanal(false)
        router.replace('/canal')
        return
      }

      const [slugs, empCatRes] = await Promise.all([
        tipoLocal === 'profissional' ? buscarSlugsCategoriasProfissional(supabase, uid) : Promise.resolve([]),
        tipoLocal === 'empresa'
          ? supabase.from('empresas').select('categoria').eq('usuario_id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (cancelado) return

      setEmpresaCategoria(empCatRes.data?.categoria != null ? String(empCatRes.data.categoria) : null)

      const { data, error } = canalRes
      if (error || !data) {
        setCanal(null)
        setCanalMissing(true)
        setCarregandoCanal(false)
        return
      }

      const empRaw = data.empresas as EmpresaCanalEmbed | EmpresaCanalEmbed[] | null | undefined
      const emp = Array.isArray(empRaw) ? empRaw[0] : empRaw

      const row: CanalRow = {
        id: String(data.id),
        nome: String(data.nome ?? ''),
        tipo_publico: data.tipo_publico != null ? String(data.tipo_publico) : null,
        comunidade_prof: data.comunidade_prof != null ? String(data.comunidade_prof) : null,
        categoria: data.categoria != null ? String(data.categoria) : null,
        empresa_id: data.empresa_id != null ? String(data.empresa_id) : null,
        empresas: emp
          ? {
              nome_fantasia: emp.nome_fantasia != null ? String(emp.nome_fantasia) : null,
              cidade: emp.cidade != null ? String(emp.cidade) : null,
              foto_url: emp.foto_url != null ? String(emp.foto_url) : null,
            }
          : null,
      }

      if (tipoLocal === 'profissional') {
        if (isCanalAdmProfissionalGlobal(row)) {
          setCarregandoCanal(false)
          router.replace('/canal')
          return
        }
        if (row.tipo_publico === 'profissional' && !canalGlobalProfissionalVisivel(row, slugs)) {
          setCanal(null)
          setCanalMissing(true)
          setCarregandoCanal(false)
          return
        }
        if (row.tipo_publico === 'empresa' && row.empresa_id) {
          const okEmpresa = canalEmpresaVisivelParaProfissional(row, slugs, null)
          if (!okEmpresa) {
            setCanal(null)
            setCanalMissing(true)
            setCarregandoCanal(false)
            return
          }
        }
      }

      setCanal(row)
      setCanalMissing(false)
      setCarregandoCanal(false)

      const ehCanalSegmentoEmp =
        tipoLocal === 'empresa' &&
        row.tipo_publico === 'empresa' &&
        row.empresa_id == null &&
        ehCanalSegmentoEmpresaGlobal(row)

      const precisaInboxEmp =
        tipoLocal === 'empresa' &&
        row.tipo_publico === 'empresa' &&
        row.empresa_id == null &&
        !isCanalFinanceiroEmpresa(row.nome) &&
        (isCanalAdmEmpresaGlobal(row) || ehCanalSegmentoEmp)

      if (precisaInboxEmp) {
        void (async () => {
          const admId = isCanalAdmEmpresaGlobal(row) ? row.id : await buscarIdCanalAdmEmpresaGlobal(supabase)
          if (!admId) return
          const inbox = await resolverInboxCanalAdmEmpresa(supabase, uid, admId)
          if (!cancelado) setInboxCanalAdm(inbox)
        })()
      }
    })()

    return () => {
      cancelado = true
    }
  }, [canalId, router, modoAtivo, perfilSimulado, tipoEfetivoDeRole])

  useEffect(() => {
    if (!canal) return
    if (userTipoEfetivo === 'empresa' && canal.tipo_publico === 'profissional') setAbaPais('BR')
    else if (userTipoEfetivo === 'empresa') setAbaPais('geral')
  }, [canal, userTipoEfetivo])

  /** Aquece imagens do chat antes do bundle do CanalMensagens (primeira abertura do app). */
  useEffect(() => {
    if (!canalId || !canal) return
    if (isCanalFinanceiroProfissional(canal.nome) || isCanalFinanceiroEmpresa(canal.nome)) return

    let cancelado = false
    void (async () => {
      try {
        const rows = await listarMensagensCanalRecentes(supabase, canalId, { limit: 24 })
        if (cancelado) return
        const stubs = rows.map((r) => ({
          anexo_url: r.anexo_url != null ? String(r.anexo_url) : null,
          anexo_tipo: r.anexo_tipo != null ? String(r.anexo_tipo) : null,
        }))
        await aquecerCacheImagensMensagensCanal(supabase, stubs, { canalId, limit: 16 })
      } catch {
        /* não bloqueia abertura do canal */
      }
    })()

    return () => {
      cancelado = true
    }
  }, [canalId, canal])

  const pathname = usePathname()

  const marcarLeituraCanalAtualRapida = useCallback(() => {
    if (!usuarioId || !canalId || !canal) return
    const token = accessTokenRef.current
    if (!token) return

    if (userTipoEfetivo === 'profissional' && canal.nome && isCanalFinanceiroProfissional(canal.nome)) {
      return
    }
    if (userTipoEfetivo === 'empresa' && canal.nome && isCanalFinanceiroEmpresa(canal.nome)) {
      return
    }

    if (
      userTipoEfetivo === 'empresa' &&
      inboxCanalAdm != null &&
      'canaisBroadcastIds' in inboxCanalAdm
    ) {
      const ids = [inboxCanalAdm.canalAdmId, ...inboxCanalAdm.canaisBroadcastIds].filter(Boolean)
      marcarCanaisLidosKeepalive(token, usuarioId, ids)
    } else {
      enviarMarcacaoLeituraKeepalive(token, usuarioId, canalId, null)
    }
    notificarBadgeCanais()
  }, [usuarioId, canalId, canal, userTipoEfetivo, inboxCanalAdm])

  const marcarLeituraCanalAtual = useCallback(async () => {
    if (!usuarioId || !canalId || !canal) return

    if (userTipoEfetivo === 'profissional' && canal.nome && isCanalFinanceiroProfissional(canal.nome)) {
      await marcarFinanceiroLidoProfissional(supabase, usuarioId)
    } else if (userTipoEfetivo === 'empresa' && canal.nome && isCanalFinanceiroEmpresa(canal.nome)) {
      await marcarFinanceiroLidoEmpresa(supabase, usuarioId)
    } else if (
      userTipoEfetivo === 'empresa' &&
      inboxCanalAdm != null &&
      'canaisBroadcastIds' in inboxCanalAdm
    ) {
      const ids = [inboxCanalAdm.canalAdmId, ...inboxCanalAdm.canaisBroadcastIds]
      await Promise.all(
        ids.filter(Boolean).map((id) => marcarCanalComoLido(supabase, usuarioId, id, null)),
      )
    } else {
      await marcarCanalComoLido(supabase, usuarioId, canalId, null)
    }
    notificarBadgeCanais()
  }, [usuarioId, canalId, canal, userTipoEfetivo, inboxCanalAdm])

  /** Ao sair do detalhe, marca leitura em background (keepalive já disparado no voltar). */
  useEffect(() => {
    return () => {
      marcarLeituraCanalAtualRapida()
      void marcarLeituraCanalAtual()
    }
  }, [pathname, marcarLeituraCanalAtual, marcarLeituraCanalAtualRapida])

  useEffect(() => {
    setDrawerCanalAberto(false)
    setDestaqueMensagemId(null)
  }, [canalId])

  const ehCanalEmpresaParaProfissional = useMemo(
    () =>
      canal != null &&
      userTipoEfetivo === 'profissional' &&
      canal.tipo_publico === 'empresa' &&
      canal.empresa_id != null,
    [canal, userTipoEfetivo],
  )

  const tituloCanal = useMemo(() => {
    if (canal == null) return '…'
    if (ehCanalEmpresaParaProfissional) {
      return String(canal.empresas?.nome_fantasia ?? '').trim() || canal.nome
    }
    if (userTipoEfetivo === 'empresa' && canal.comunidade_prof) {
      return tituloCanalEmpresaLista(canal.comunidade_prof)
    }
    if (
      userTipoEfetivo === 'empresa' &&
      canal.tipo_publico === 'empresa' &&
      canal.empresa_id == null &&
      !isCanalFinanceiroEmpresa(canal.nome)
    ) {
      if (ehCanalSegmentoEmpresaGlobal(canal)) return rotuloCanalSegmentoEmpresaParaEmpresa(canal)
      if (isCanalAdmEmpresaGlobal(canal)) return rotuloCanalSegmentoPorCategoriaEmpresa(empresaCategoria)
      return canal.nome
    }
    if (userTipoEfetivo === 'profissional') {
      return rotuloCanalListaProfissional(canal, isCanalFinanceiroProfissional)
    }
    return canal.nome
  }, [canal, userTipoEfetivo, ehCanalEmpresaParaProfissional, empresaCategoria])

  const ehCanalFinanceiroAtual = useMemo(() => {
    if (!canal) return false
    return isCanalFinanceiroProfissional(canal.nome) || isCanalFinanceiroEmpresa(canal.nome)
  }, [canal])

  const paisTabDrawer = useMemo(() => {
    if (userTipoEfetivo === 'empresa' && canal?.tipo_publico === 'profissional') return abaPais
    if (userTipoEfetivo === 'admin' && canal && !canalMensageiroAdmSemAbasPais(canal.nome)) return abaPais
    return 'geral'
  }, [userTipoEfetivo, canal, abaPais])

  const abrirDrawerCanal = useCallback(() => {
    if (ehCanalFinanceiroAtual || !canal) return
    setDrawerCanalAberto(true)
  }, [ehCanalFinanceiroAtual, canal])

  const fecharDrawerCanal = useCallback(() => {
    setDrawerCanalAberto(false)
  }, [])

  const drawerCanalOverlay =
    drawerCanalAberto && canal && !ehCanalFinanceiroAtual ? (
      <CanalDrawer
        aberto
        onFechar={fecharDrawerCanal}
        canalId={canalId}
        canal={canal}
        tituloCanal={tituloCanal}
        usuarioId={usuarioId}
        paisTab={paisTabDrawer}
        onAbrirSalvosMensagem={(id) => {
          setDestaqueMensagemId(id)
          fecharDrawerCanal()
        }}
      />
    ) : null

  const voltarCanais = useCallback(() => {
    marcarLeituraCanalAtualRapida()
    router.push('/canal')
    void marcarLeituraCanalAtual()
  }, [router, marcarLeituraCanalAtual, marcarLeituraCanalAtualRapida])

  if (!authPronto || userTipoEfetivo == null || carregandoCanal) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-[#0097b2] px-2 py-3 text-white shadow-sm">
          <button
            type="button"
            onClick={() => router.push('/canal')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <span className="truncate text-lg font-semibold">…</span>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-pulse text-sm text-gray-400">Carregando...</div>
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'turista') {
    return (
      <div className="flex min-h-screen items-center justify-center pb-20">
        <div className="text-sm text-gray-400">A redirecionar...</div>
      </div>
    )
  }

  if (canalMissing || !canal) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 pb-20">
        <p className="text-center text-gray-600">Canal não encontrado ou sem permissão.</p>
        <button
          type="button"
          onClick={() => voltarCanais()}
          className="rounded-lg bg-[#0097b2] px-4 py-2 text-sm font-medium text-white"
        >
          Voltar aos canais
        </button>
      </div>
    )
  }

  if (userTipoEfetivo === 'profissional') {
    const isFinanceiro = canal != null && isCanalFinanceiroProfissional(canal.nome)
    return (
      <>
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-[#0097b2] px-2 py-3 text-white shadow-sm">
          <button
            type="button"
            onClick={() => voltarCanais()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <CanalHeaderTitulo onAbrirDrawer={abrirDrawerCanal} disabled={isFinanceiro}>
            {isFinanceiro ? (
              <CanalFinanceiroListaRotulo username={meuUsername} inverse />
            ) : ehCanalEmpresaParaProfissional ? (
              <span className="flex min-w-0 items-center justify-center gap-2 truncate text-lg font-semibold">
                <BandeiraPais cidade={canal?.empresas?.cidade} className="text-lg leading-none" />
                <span className="truncate">{tituloCanal}</span>
              </span>
            ) : (
              <span className="truncate text-lg font-semibold">{tituloCanal}</span>
            )}
          </CanalHeaderTitulo>
          <button
            type="button"
            onClick={() => abrirDrawerCanal()}
            disabled={isFinanceiro}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"
            aria-label="Opções do canal"
          >
            <MoreVertical className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          {canal != null && isFinanceiro && financeUid ? (
            recursosProfissionaisLiberados ? (
              <CanalFinanceiroLista usuarioId={financeUid} tipo="profissional" />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-start px-4 py-10 text-center text-sm text-gray-600">
                <p>O canal financeiro é liberado após a verificação dos seus documentos.</p>
                <p className="mt-2 text-xs text-gray-500">Menu → USUÁRIO → Anexar Documentos.</p>
              </div>
            )
          ) : (
            <CanalMensagens
              canalId={canalId}
              usuarioId={usuarioId}
              paisTab="geral"
              podePostar={false}
              podeReagir={podeInteragir}
              inboxCanalAdm={null}
              canalNome={tituloCanal}
              destaqueMensagemId={destaqueMensagemId}
            />
          )}
        </div>
      </div>
      {drawerCanalOverlay}
      </>
    )
  }

  if (userTipoEfetivo === 'empresa') {
    const isFinanceiro = canal != null && isCanalFinanceiroEmpresa(canal.nome)
    const isCanalAdmInbox =
      canal != null &&
      inboxCanalAdm != null &&
      canal.tipo_publico === 'empresa' &&
      canal.empresa_id == null &&
      !isFinanceiro &&
      (isCanalAdmEmpresaGlobal(canal) || ehCanalSegmentoEmpresaGlobal(canal))
    const mostrarAbasTresPaises = canal != null && canal.tipo_publico === 'profissional'
    const podePostarCanal =
      canal != null &&
      !isCanalAdmInbox &&
      canal.tipo_publico === 'empresa' &&
      canal.empresa_id != null &&
      podeInteragir
    return (
      <>
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-[#0097b2] px-2 py-3 text-white shadow-sm">
          <button
            type="button"
            onClick={() => voltarCanais()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <CanalHeaderTitulo onAbrirDrawer={abrirDrawerCanal} disabled={isFinanceiro}>
            {isFinanceiro ? (
              <CanalFinanceiroListaRotulo username={meuUsername} inverse />
            ) : (
              <span className="truncate text-lg font-semibold">{tituloCanal}</span>
            )}
          </CanalHeaderTitulo>
          <button
            type="button"
            onClick={() => abrirDrawerCanal()}
            disabled={isFinanceiro}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"
            aria-label="Opções do canal"
          >
            <MoreVertical className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          {canal != null && isFinanceiro && financeUid ? (
            <CanalFinanceiroLista usuarioId={financeUid} tipo="empresa" />
          ) : (
            <>
              {mostrarAbasTresPaises ? (
                <div className="shrink-0 border-b border-gray-100 bg-white">
                  <CanalAbasPais paises={paisesEmpresaProfissionais} abaAtiva={abaPais} onAbaChange={setAbaPais} />
                </div>
              ) : null}
              <CanalMensagens
                canalId={canalId}
                usuarioId={usuarioId}
                paisTab={mostrarAbasTresPaises ? abaPais : 'geral'}
                podePostar={podePostarCanal}
                podeReagir={podeInteragir}
                inboxCanalAdm={isCanalAdmInbox ? inboxCanalAdm : null}
                inboxModo="empresa"
                canalNome={tituloCanal}
                destaqueMensagemId={destaqueMensagemId}
              />
            </>
          )}
        </div>
      </div>
      {drawerCanalOverlay}
      </>
    )
  }

  if (userTipoEfetivo === 'admin') {
    const mostrarAbasPais = canal != null && !canalMensageiroAdmSemAbasPais(canal.nome)
    return (
      <>
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-[#0097b2] px-2 py-3 text-white shadow-sm">
          <button
            type="button"
            onClick={() => voltarCanais()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <CanalHeaderTitulo onAbrirDrawer={abrirDrawerCanal}>
            <span className="truncate text-lg font-semibold">{tituloCanal}</span>
          </CanalHeaderTitulo>
          <button
            type="button"
            onClick={() => abrirDrawerCanal()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Opções do canal"
          >
            <MoreVertical className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          {mostrarAbasPais ? (
            <div className="shrink-0 border-b border-gray-100 bg-white">
              <CanalAbasPais paises={paises} abaAtiva={abaPais} onAbaChange={setAbaPais} />
            </div>
          ) : null}
          <CanalMensagens
            canalId={canalId}
            usuarioId={usuarioId}
            paisTab={mostrarAbasPais ? abaPais : 'geral'}
            podePostar={podeInteragir}
            podeReagir={podeInteragir}
            canalNome={tituloCanal}
            destaqueMensagemId={destaqueMensagemId}
          />
        </div>
      </div>
      {drawerCanalOverlay}
      </>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 pb-20">
      <p className="text-center text-gray-600">Perfil não suportado.</p>
      <button type="button" onClick={() => voltarCanais()} className="mt-4 text-[#0097b2]">
        Voltar
      </button>
    </div>
  )
}
