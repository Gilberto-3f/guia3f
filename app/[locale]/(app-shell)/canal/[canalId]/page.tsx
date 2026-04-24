'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import CanalMensagens from '@/components/CanalMensagens'
import CanalAbasPais from '@/components/CanalAbasPais'
import CanalFinanceiroLista from '@/components/CanalFinanceiroLista'
import { tituloCanalEmpresaLista } from '@/components/ListaCanaisEmpresa'
import { rotuloNomeCanalAdministracao } from '@/lib/rotulosCanaisAdministracao'

type TipoUsuario = 'turista' | 'profissional' | 'empresa' | 'admin' | null

type CanalRow = { id: string; nome: string; tipo_publico: string | null; comunidade_prof: string | null }

function isCanalNomeFinanceiro(nome: string) {
  return nome.trim().toUpperCase() === 'FINANCEIRO'
}

export default function CanalDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const canalId = params?.canalId != null ? String(params.canalId) : ''

  const { modoAtivo, perfilSimulado, contextoUsuarioId, podeInteragir } = useModoApresentacao()
  const [userTipo, setUserTipo] = useState<TipoUsuario>(null)
  const [authPronto, setAuthPronto] = useState(false)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [carregandoCanal, setCarregandoCanal] = useState(true)
  const [canal, setCanal] = useState<CanalRow | null>(null)
  const [canalMissing, setCanalMissing] = useState(false)
  const [abaPais, setAbaPais] = useState('geral')

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

  const financeUid = useMemo(() => {
    if (
      modoAtivo &&
      contextoUsuarioId &&
      (perfilSimulado?.tipo === 'profissional' || perfilSimulado?.tipo === 'empresa')
    ) {
      return contextoUsuarioId
    }
    return usuarioId
  }, [modoAtivo, contextoUsuarioId, perfilSimulado?.tipo, usuarioId])

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
      const { data, error } = await supabase
        .from('canais')
        .select('id, nome, tipo_publico, comunidade_prof')
        .eq('id', canalId)
        .maybeSingle()

      if (error || !data) {
        setCanal(null)
        setCanalMissing(true)
      } else {
        setCanal({
          id: String(data.id),
          nome: String(data.nome ?? ''),
          tipo_publico: data.tipo_publico != null ? String(data.tipo_publico) : null,
          comunidade_prof: data.comunidade_prof != null ? String(data.comunidade_prof) : null,
        })
        setCanalMissing(false)
      }
      setCarregandoCanal(false)
    })()
  }, [authPronto, userTipoEfetivo, canalId, router])

  useEffect(() => {
    if (!canal) return
    if (userTipoEfetivo === 'empresa' && canal.tipo_publico === 'profissional') setAbaPais('BR')
    else if (userTipoEfetivo === 'empresa') setAbaPais('geral')
  }, [canal, userTipoEfetivo])

  useEffect(() => {
    if (userTipoEfetivo !== 'profissional' || !usuarioId || !canalId || !canal) return

    void (async () => {
      await supabase.from('canal_leitura_profissional').upsert(
        {
          usuario_id: usuarioId,
          canal_id: canalId,
          visto_em: new Date().toISOString(),
        },
        { onConflict: 'usuario_id,canal_id' },
      )
    })()
  }, [userTipoEfetivo, usuarioId, canalId, canal])

  const voltarCanais = () => {
    router.push('/canal')
  }

  if (!authPronto || (userTipoEfetivo !== 'turista' && carregandoCanal)) {
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
    const isFinanceiro = isCanalNomeFinanceiro(canal.nome)
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-100 bg-white px-2 py-3">
          <button
            type="button"
            onClick={() => voltarCanais()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="min-w-0 flex-1 text-lg font-bold text-gray-800">{rotuloNomeCanalAdministracao(canal.nome)}</h1>
        </header>
        <div className="flex min-h-0 min-h-[calc(100dvh-4rem)] flex-1 flex-col">
          {isFinanceiro && financeUid ? (
            <CanalFinanceiroLista usuarioId={financeUid} tipo="profissional" />
          ) : (
            <CanalMensagens canalId={canalId} paisTab="geral" podePostar={false} podeReagir={podeInteragir} />
          )}
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'empresa') {
    const isFinanceiro = isCanalNomeFinanceiro(canal.nome)
    const mostrarAbasTresPaises = canal.tipo_publico === 'profissional'
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-100 bg-white px-2 py-3">
          <button
            type="button"
            onClick={() => voltarCanais()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="min-w-0 flex-1 text-lg font-bold text-gray-800">
            {canal.comunidade_prof
              ? tituloCanalEmpresaLista(canal.comunidade_prof)
              : rotuloNomeCanalAdministracao(canal.nome)}
          </h1>
        </header>
        <div className="flex min-h-0 min-h-[calc(100dvh-4rem)] flex-1 flex-col">
          {isFinanceiro && financeUid ? (
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
                podePostar={podeInteragir}
                podeReagir={podeInteragir}
              />
            </>
          )}
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'admin') {
    const mostrarAbasPais = canal.nome !== 'Mensageiro ADM'
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-100 bg-white px-2 py-3">
          <button
            type="button"
            onClick={() => voltarCanais()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="min-w-0 flex-1 text-lg font-bold text-gray-800">{rotuloNomeCanalAdministracao(canal.nome)}</h1>
        </header>
        <div className="flex min-h-0 min-h-[calc(100dvh-4rem)] flex-1 flex-col">
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
