'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { ChevronLeft, MoreVertical } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import BandeiraPais from '@/components/BandeiraPais'
import CanalMensagens from '@/components/CanalMensagens'
import CanalAbasPais from '@/components/CanalAbasPais'
import CanalFinanceiroLista from '@/components/CanalFinanceiroLista'
import { tituloCanalEmpresaLista } from '@/components/ListaCanaisEmpresa'
import { rotuloCanalListaProfissional } from '@/lib/canaisProfissionaisListaUi'
import { marcarCanalComoLidoResiliente } from '@/lib/canalBadge'
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

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      setUsuarioId(session.user.id)

      const { data: userData } = await supabase.from('usuarios').select('role').eq('id', session.user.id).maybeSingle()
      const role = userData?.role ?? null

      if (role === 'turista') setUserTipo('turista')
      else if (role === 'profissional') setUserTipo('profissional')
      else if (role === 'empresa') setUserTipo('empresa')
      else if (role === 'admin') setUserTipo('admin')
      else setUserTipo(null)

      setAuthPronto(true)
    }

    void init()
  }, [router])

  useEffect(() => {
    if (!authPronto) return
    if (userTipoEfetivo === 'turista') {
      setCarregandoCanal(false)
      router.replace('/canal')
      return
    }
    if (!canalId) {
      setCanal(null)
      setCanalMissing(true)
      setCarregandoCanal(false)
      return
    }

    void (async () => {
      setCarregandoCanal(true)
      setCanalMissing(false)
      setInboxCanalAdm(null)

      const canalQuery = supabase
        .from('canais')
        .select(
          `
          id, nome, tipo_publico, comunidade_prof, categoria, empresa_id,
          empresas:empresa_id ( nome_fantasia, cidade, foto_url )
          `,
        )
        .eq('id', canalId)
        .maybeSingle()

      const slugsPromise =
        userTipoEfetivo === 'profissional' && usuarioId
          ? buscarSlugsCategoriasProfissional(supabase, usuarioId)
          : Promise.resolve([])

      const empresaCatPromise =
        userTipoEfetivo === 'empresa' && usuarioId
          ? supabase.from('empresas').select('categoria').eq('usuario_id', usuarioId).maybeSingle()
          : Promise.resolve({ data: null })

      const [{ data, error }, slugs, empCatRes] = await Promise.all([canalQuery, slugsPromise, empresaCatPromise])
      setEmpresaCategoria(
        empCatRes.data?.categoria != null ? String(empCatRes.data.categoria) : null,
      )

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

      if (userTipoEfetivo === 'profissional' && usuarioId) {
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
        userTipoEfetivo === 'empresa' &&
        row.tipo_publico === 'empresa' &&
        row.empresa_id == null &&
        ehCanalSegmentoEmpresaGlobal(row)

      const precisaInboxEmp =
        userTipoEfetivo === 'empresa' &&
        usuarioId &&
        row.tipo_publico === 'empresa' &&
        row.empresa_id == null &&
        !isCanalFinanceiroEmpresa(row.nome) &&
        (isCanalAdmEmpresaGlobal(row) || ehCanalSegmentoEmp)

      if (precisaInboxEmp) {
        void (async () => {
          const admId = isCanalAdmEmpresaGlobal(row)
            ? row.id
            : await buscarIdCanalAdmEmpresaGlobal(supabase)
          if (!admId) return
          const inbox = await resolverInboxCanalAdmEmpresa(supabase, usuarioId, admId)
          setInboxCanalAdm(inbox)
        })()
      }
    })()
  }, [authPronto, userTipoEfetivo, canalId, router, usuarioId])

  useEffect(() => {
    if (!canal) return
    if (userTipoEfetivo === 'empresa' && canal.tipo_publico === 'profissional') setAbaPais('BR')
    else if (userTipoEfetivo === 'empresa') setAbaPais('geral')
  }, [canal, userTipoEfetivo])

  const pathname = usePathname()

  const marcarLeituraCanalAtual = useCallback(async () => {
    if (!usuarioId || !canalId || !canal) return
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token ?? null

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
      for (const id of ids) {
        if (id) await marcarCanalComoLidoResiliente(supabase, usuarioId, id, null, token)
      }
    } else {
      await marcarCanalComoLidoResiliente(supabase, usuarioId, canalId, null, token)
    }
    notificarBadgeCanais()
  }, [usuarioId, canalId, canal, userTipoEfetivo, inboxCanalAdm])

  /** Ao sair do detalhe (Home, barra, outro canal), garante gravação antes da recontagem da barra. */
  useEffect(() => {
    return () => {
      void marcarLeituraCanalAtual()
    }
  }, [pathname, marcarLeituraCanalAtual])

  const voltarCanais = () => {
    void (async () => {
      await marcarLeituraCanalAtual()
      router.push('/canal')
    })()
  }

  if (!authPronto) {
    return (
      <div className="flex min-h-screen items-center justify-center pb-20">
        <div className="animate-pulse text-gray-400">Carregando...</div>
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

  if (!carregandoCanal && (canalMissing || !canal)) {
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

  const ehCanalEmpresaParaProfissional =
    canal != null &&
    userTipoEfetivo === 'profissional' &&
    canal.tipo_publico === 'empresa' &&
    canal.empresa_id != null

  const tituloCanal =
    canal == null
      ? '…'
      : ehCanalEmpresaParaProfissional
        ? String(canal.empresas?.nome_fantasia ?? '').trim() || canal.nome
        : userTipoEfetivo === 'empresa' && canal.comunidade_prof
          ? tituloCanalEmpresaLista(canal.comunidade_prof)
          : userTipoEfetivo === 'empresa' &&
              canal.tipo_publico === 'empresa' &&
              canal.empresa_id == null &&
              !isCanalFinanceiroEmpresa(canal.nome)
            ? ehCanalSegmentoEmpresaGlobal(canal)
              ? rotuloCanalSegmentoEmpresaParaEmpresa(canal)
              : isCanalAdmEmpresaGlobal(canal)
                ? rotuloCanalSegmentoPorCategoriaEmpresa(empresaCategoria)
                : canal.nome
            : userTipoEfetivo === 'profissional'
              ? rotuloCanalListaProfissional(canal, isCanalFinanceiroProfissional)
              : canal.nome

  if (userTipoEfetivo === 'profissional') {
    const isFinanceiro = canal != null && isCanalFinanceiroProfissional(canal.nome)
    return (
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
          <h1 className="flex min-w-0 flex-1 items-center justify-center gap-2 truncate text-center text-lg font-semibold">
            {ehCanalEmpresaParaProfissional ? (
              <>
                <BandeiraPais cidade={canal.empresas?.cidade} className="text-lg leading-none" />
                <span className="truncate">{tituloCanal}</span>
              </>
            ) : (
              <span className="truncate">{tituloCanal}</span>
            )}
          </h1>
          <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Opções do canal">
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
              paisTab="geral"
              podePostar={false}
              podeReagir={podeInteragir}
              inboxCanalAdm={null}
            />
          )}
        </div>
      </div>
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
          <h1 className="min-w-0 flex-1 truncate text-center text-lg font-semibold">{tituloCanal}</h1>
          <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Opções do canal">
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
                paisTab={mostrarAbasTresPaises ? abaPais : 'geral'}
                podePostar={podePostarCanal}
                podeReagir={podeInteragir}
                inboxCanalAdm={isCanalAdmInbox ? inboxCanalAdm : null}
                inboxModo="empresa"
              />
            </>
          )}
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'admin') {
    const mostrarAbasPais = canal != null && !canalMensageiroAdmSemAbasPais(canal.nome)
    return (
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
          <h1 className="min-w-0 flex-1 truncate text-center text-lg font-semibold">{tituloCanal}</h1>
          <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Opções do canal">
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
            paisTab={mostrarAbasPais ? abaPais : 'geral'}
            podePostar={podeInteragir}
            podeReagir={podeInteragir}
          />
        </div>
      </div>
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
