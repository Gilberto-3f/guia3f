'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import CanalMensagens from '@/components/CanalMensagens'
import CanalAbasPais from '@/components/CanalAbasPais'
import CanalFinanceiroLista from '@/components/CanalFinanceiroLista'
import { tituloCanalEmpresaLista } from '@/components/ListaCanaisEmpresa'
import { marcarCanalComoLido } from '@/lib/canalBadge'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { canalMensageiroAdmSemAbasPais, rotuloNomeCanalAdministracao } from '@/lib/rotulosCanaisAdministracao'
import { isCanalAdmProfissionalGlobal, isCanalFinanceiroProfissional } from '@/lib/canaisProfissionalSlugs'
import {
  resolverInboxCanalAdmProfissional,
  type CanalAdmInboxConfig,
} from '@/lib/canaisProfissionalAdm'
import {
  isCanalAdmEmpresaGlobal,
  isCanalFinanceiroEmpresa,
} from '@/lib/canaisEmpresaSlugs'
import {
  resolverInboxCanalAdmEmpresa,
  type CanalAdmEmpresaInboxConfig,
} from '@/lib/canaisEmpresaAdm'

type TipoUsuario = 'turista' | 'profissional' | 'empresa' | 'admin' | null

type CanalRow = {
  id: string
  nome: string
  tipo_publico: string | null
  comunidade_prof: string | null
  categoria: string | null
  empresa_id: string | null
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

      const { data, error } = await supabase
        .from('canais')
        .select('id, nome, tipo_publico, comunidade_prof, categoria, empresa_id')
        .eq('id', canalId)
        .maybeSingle()

      if (error || !data) {
        setCanal(null)
        setCanalMissing(true)
        setCarregandoCanal(false)
        return
      }

      const row: CanalRow = {
        id: String(data.id),
        nome: String(data.nome ?? ''),
        tipo_publico: data.tipo_publico != null ? String(data.tipo_publico) : null,
        comunidade_prof: data.comunidade_prof != null ? String(data.comunidade_prof) : null,
        categoria: data.categoria != null ? String(data.categoria) : null,
        empresa_id: data.empresa_id != null ? String(data.empresa_id) : null,
      }
      setCanal(row)
      setCanalMissing(false)
      setCarregandoCanal(false)

      const precisaInboxProf =
        userTipoEfetivo === 'profissional' &&
        usuarioId &&
        isCanalAdmProfissionalGlobal(row) &&
        !isCanalFinanceiroProfissional(row.nome)
      const precisaInboxEmp =
        userTipoEfetivo === 'empresa' &&
        usuarioId &&
        isCanalAdmEmpresaGlobal(row) &&
        !isCanalFinanceiroEmpresa(row.nome)

      if (precisaInboxProf) {
        void resolverInboxCanalAdmProfissional(supabase, usuarioId, row.id).then(setInboxCanalAdm)
      } else if (precisaInboxEmp) {
        void resolverInboxCanalAdmEmpresa(supabase, usuarioId, row.id).then(setInboxCanalAdm)
      }
    })()
  }, [authPronto, userTipoEfetivo, canalId, router, usuarioId])

  useEffect(() => {
    if (!canal) return
    if (userTipoEfetivo === 'empresa' && canal.tipo_publico === 'profissional') setAbaPais('BR')
    else if (userTipoEfetivo === 'empresa') setAbaPais('geral')
  }, [canal, userTipoEfetivo])

  useEffect(() => {
    if (!usuarioId || !canalId || !canal) return

    void (async () => {
      await marcarCanalComoLido(supabase, usuarioId, canalId)
      notificarBadgeCanais()
    })()
  }, [usuarioId, canalId, canal])

  const voltarCanais = () => {
    router.push('/canal')
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

  const tituloCanal =
    canal == null
      ? '…'
      : userTipoEfetivo === 'empresa' && canal.comunidade_prof
        ? tituloCanalEmpresaLista(canal.comunidade_prof)
        : rotuloNomeCanalAdministracao(canal.nome)

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
          <h1 className="min-w-0 flex-1 truncate text-center text-lg font-semibold">{tituloCanal}</h1>
          <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Opções">
            ⋮
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
              inboxCanalAdm={inboxCanalAdm}
            />
          )}
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'empresa') {
    const isFinanceiro = canal != null && isCanalFinanceiroEmpresa(canal.nome)
    const isCanalAdmInbox = canal != null && isCanalAdmEmpresaGlobal(canal) && inboxCanalAdm != null
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
          <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Opções">
            ⋮
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
          <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Opções">
            ⋮
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
