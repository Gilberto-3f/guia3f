'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import ListaCanais from '@/components/ListaCanais'
import ListaCanaisProfissional from '@/components/ListaCanaisProfissional'
import CanalMensagens from '@/components/CanalMensagens'
import CanalAbasPais from '@/components/CanalAbasPais'
import CanalFinanceiroLista from '@/components/CanalFinanceiroLista'

type TipoUsuario = 'turista' | 'profissional' | 'empresa' | 'admin' | null

type CanalSelecionado = { id?: string; nome?: string } | null

export default function CanalPage() {
  const router = useRouter()
  const { modoAtivo, perfilSimulado, contextoUsuarioId, podeInteragir } = useModoApresentacao()
  const [userTipo, setUserTipo] = useState<TipoUsuario>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [turismoCanalId, setTurismoCanalId] = useState<string | null>(null)
  const [carregandoTurismo, setCarregandoTurismo] = useState(false)

  const [canalSelecionado, setCanalSelecionado] = useState<CanalSelecionado>(null)
  const [abaPais, setAbaPais] = useState('geral')
  const [leituraProfTick, setLeituraProfTick] = useState(0)

  const paises = ['BR', 'AR', 'PY', 'geral']

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

      setLoading(false)
    }

    void init()
  }, [router])

  useEffect(() => {
    if (userTipoEfetivo !== 'turista') return

    const load = async () => {
      setCarregandoTurismo(true)
      const { data } = await supabase
        .from('canais')
        .select('id')
        .eq('tipo_publico', 'turista')
        .eq('nome', 'Turismo')
        .maybeSingle()

      setTurismoCanalId(data?.id != null ? String(data.id) : null)
      setCarregandoTurismo(false)
    }

    void load()
  }, [userTipoEfetivo])

  useEffect(() => {
    if (userTipoEfetivo !== 'profissional' || !usuarioId || !canalSelecionado?.id) return

    void (async () => {
      await supabase.from('canal_leitura_profissional').upsert(
        {
          usuario_id: usuarioId,
          canal_id: canalSelecionado.id,
          visto_em: new Date().toISOString(),
        },
        { onConflict: 'usuario_id,canal_id' },
      )
      setLeituraProfTick((t) => t + 1)
    })()
  }, [userTipoEfetivo, usuarioId, canalSelecionado?.id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando...</div>
      </div>
    )
  }

  if (userTipoEfetivo === 'turista') {
    if (carregandoTurismo || !turismoCanalId) {
      return (
        <div className="flex min-h-screen items-center justify-center pb-20">
          <div className="animate-pulse text-gray-400">Carregando canal...</div>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
          <div className="p-4">
            <h1 className="text-xl font-bold text-gray-800">Canal do turista</h1>
            <p className="text-sm text-gray-500">Informações, promoções e dicas</p>
          </div>
        </div>
        <div className="flex min-h-[calc(100vh-8rem)] flex-1 flex-col">
          <CanalMensagens canalId={turismoCanalId} paisTab="geral" podePostar={false} podeReagir={podeInteragir} />
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'profissional') {
    const sel = canalSelecionado
    const isFinanceiro = sel?.nome === 'Financeiro'
    const semCanal = !sel?.id

    return (
      <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
          <div className="p-4">
            <h1 className="text-xl font-bold text-gray-800">Canais</h1>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col-reverse md:min-h-[calc(100vh-7rem)] md:flex-row">
          <div
            className={`flex w-full shrink-0 flex-col overflow-hidden border-t border-gray-200 bg-white shadow-[0_-4px_14px_rgba(0,0,0,0.06)] md:w-72 md:border-r md:border-gray-100 md:shadow-none ${
              semCanal
                ? 'min-h-0 flex-1 max-md:border-t-0 max-md:shadow-none md:h-auto md:max-h-none md:flex-none'
                : 'max-h-[40vh] min-h-[7.5rem] max-md:border-t md:h-auto md:max-h-none md:min-h-0 md:border-t-0'
            }`}
          >
            <ListaCanaisProfissional
              onSelectCanal={setCanalSelecionado}
              canalSelecionadoId={sel?.id != null ? String(sel.id) : undefined}
              leituraTick={leituraProfTick}
            />
          </div>

          <div className={`min-h-0 min-w-0 flex-1 flex-col ${semCanal ? 'hidden md:flex' : 'flex'}`}>
            {sel?.id ? (
              isFinanceiro && financeUid ? (
                <CanalFinanceiroLista usuarioId={financeUid} tipo="profissional" />
              ) : (
                <>
                  <div className="border-b border-gray-100 bg-white p-4">
                    <h2 className="font-semibold text-gray-800">{sel.nome}</h2>
                  </div>
                  <CanalMensagens canalId={String(sel.id)} paisTab="geral" podePostar={false} podeReagir={podeInteragir} />
                </>
              )
            ) : (
              <div className="flex flex-1 min-h-0 flex-col items-center justify-center px-4 text-center text-sm text-gray-400">
                Selecione um canal
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'empresa') {
    const sel = canalSelecionado
    const isFinanceiro = sel?.nome === 'Financeiro'
    const mostrarAbasPais = sel?.nome != null && sel.nome !== 'ADM' && !isFinanceiro

    return (
      <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
          <div className="p-4">
            <h1 className="text-xl font-bold text-gray-800">Canais</h1>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col-reverse md:min-h-[calc(100vh-7rem)] md:flex-row">
          <div className="max-h-[40vh] min-h-[7.5rem] w-full shrink-0 overflow-y-auto border-t border-gray-200 bg-white shadow-[0_-4px_14px_rgba(0,0,0,0.06)] md:h-auto md:max-h-none md:min-h-0 md:w-72 md:border-t-0 md:border-r md:border-gray-100 md:shadow-none">
            <ListaCanais
              tipoPublico="empresa"
              onSelectCanal={setCanalSelecionado}
              canalSelecionadoId={sel?.id != null ? String(sel.id) : undefined}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {sel?.id ? (
              isFinanceiro && financeUid ? (
                <CanalFinanceiroLista usuarioId={financeUid} tipo="empresa" />
              ) : (
                <>
                  <div className="border-b border-gray-100 bg-white">
                    <div className="p-4">
                      <h2 className="font-semibold text-gray-800">{sel.nome}</h2>
                    </div>
                    {mostrarAbasPais ? (
                      <CanalAbasPais paises={paises} abaAtiva={abaPais} onAbaChange={setAbaPais} />
                    ) : null}
                  </div>
                  <CanalMensagens
                    canalId={String(sel.id)}
                    paisTab={mostrarAbasPais ? abaPais : 'geral'}
                    podePostar={podeInteragir}
                    podeReagir={podeInteragir}
                  />
                </>
              )
            ) : (
              <div className="flex flex-1 min-h-0 flex-col items-center justify-start px-4 pt-8 text-center text-sm text-gray-400 md:justify-center md:pt-0">
                Selecione um canal
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'admin') {
    const sel = canalSelecionado
    const mostrarAbasPais = sel?.nome != null && sel.nome !== 'Mensageiro ADM'

    return (
      <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
          <div className="p-4">
            <h1 className="text-xl font-bold text-gray-800">Canais ADM</h1>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col-reverse md:min-h-[calc(100vh-7rem)] md:flex-row">
          <div className="max-h-[40vh] min-h-[7.5rem] w-full shrink-0 overflow-y-auto border-t border-gray-200 bg-white shadow-[0_-4px_14px_rgba(0,0,0,0.06)] md:max-h-none md:min-h-0 md:w-80 md:border-t-0 md:border-r md:border-gray-100 md:shadow-none">
            <ListaCanais
              tipoPublico={null}
              agruparPorTipo
              onSelectCanal={setCanalSelecionado}
              canalSelecionadoId={sel?.id != null ? String(sel.id) : undefined}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {sel?.id ? (
              <>
                <div className="border-b border-gray-100 bg-white">
                  <div className="p-4">
                    <h2 className="font-semibold text-gray-800">{sel.nome}</h2>
                  </div>
                  {mostrarAbasPais ? (
                    <CanalAbasPais paises={paises} abaAtiva={abaPais} onAbaChange={setAbaPais} />
                  ) : null}
                </div>
                <CanalMensagens
                  canalId={String(sel.id)}
                  paisTab={mostrarAbasPais ? abaPais : 'geral'}
                  podePostar={podeInteragir}
                  podeReagir={podeInteragir}
                />
              </>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col items-center justify-start px-4 pt-8 text-center text-sm text-gray-400 md:justify-center md:pt-0">
                Selecione um canal
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900">Canal</h1>
      <p className="mt-2 text-gray-600">Perfil não suportado para canais.</p>
    </div>
  )
}
