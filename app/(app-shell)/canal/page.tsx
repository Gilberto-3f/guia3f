'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ListaCanais from '@/components/ListaCanais'
import CanalMensagens from '@/components/CanalMensagens'
import CanalAbasPais from '@/components/CanalAbasPais'
import CanalFinanceiroLista from '@/components/CanalFinanceiroLista'

type TipoUsuario = 'turista' | 'profissional' | 'empresa' | 'admin' | null

type CanalSelecionado = { id?: string; nome?: string } | null

export default function CanalPage() {
  const router = useRouter()
  const [userTipo, setUserTipo] = useState<TipoUsuario>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [turismoCanalId, setTurismoCanalId] = useState<string | null>(null)
  const [carregandoTurismo, setCarregandoTurismo] = useState(false)

  const [canalSelecionado, setCanalSelecionado] = useState<CanalSelecionado>(null)
  const [abaPais, setAbaPais] = useState('geral')

  const paises = ['BR', 'AR', 'PY', 'geral']

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
    if (userTipo !== 'turista') return

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
  }, [userTipo])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando...</div>
      </div>
    )
  }

  if (userTipo === 'turista') {
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
          <CanalMensagens canalId={turismoCanalId} paisTab="geral" podePostar={false} podeReagir={true} />
        </div>
      </div>
    )
  }

  if (userTipo === 'profissional') {
    const sel = canalSelecionado
    const isFinanceiro = sel?.nome === 'Financeiro'

    return (
      <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
          <div className="p-4">
            <h1 className="text-xl font-bold text-gray-800">Canais</h1>
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-7rem)] flex-1 flex-col md:flex-row">
          <div className="h-48 w-full shrink-0 overflow-y-auto border-b border-gray-100 bg-white md:h-auto md:w-72 md:border-b-0 md:border-r">
            <ListaCanais
              tipoPublico="profissional"
              onSelectCanal={setCanalSelecionado}
              canalSelecionadoId={sel?.id != null ? String(sel.id) : undefined}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {sel?.id ? (
              isFinanceiro && usuarioId ? (
                <CanalFinanceiroLista usuarioId={usuarioId} tipo="profissional" />
              ) : (
                <>
                  <div className="border-b border-gray-100 bg-white p-4">
                    <h2 className="font-semibold text-gray-800">{sel.nome}</h2>
                  </div>
                  <CanalMensagens canalId={String(sel.id)} paisTab="geral" podePostar={false} podeReagir={true} />
                </>
              )
            ) : (
              <div className="flex flex-1 items-center justify-center text-gray-400">Selecione um canal</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (userTipo === 'empresa') {
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

        <div className="flex min-h-[calc(100vh-7rem)] flex-1 flex-col md:flex-row">
          <div className="h-48 w-full shrink-0 overflow-y-auto border-b border-gray-100 bg-white md:h-auto md:w-72 md:border-b-0 md:border-r">
            <ListaCanais
              tipoPublico="empresa"
              onSelectCanal={setCanalSelecionado}
              canalSelecionadoId={sel?.id != null ? String(sel.id) : undefined}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {sel?.id ? (
              isFinanceiro && usuarioId ? (
                <CanalFinanceiroLista usuarioId={usuarioId} tipo="empresa" />
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
                    podePostar
                    podeReagir
                  />
                </>
              )
            ) : (
              <div className="flex flex-1 items-center justify-center text-gray-400">Selecione um canal</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (userTipo === 'admin') {
    const sel = canalSelecionado
    const mostrarAbasPais = sel?.nome != null && sel.nome !== 'Mensageiro ADM'

    return (
      <div className="flex min-h-screen flex-col bg-gray-50 pb-20">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
          <div className="p-4">
            <h1 className="text-xl font-bold text-gray-800">Canais ADM</h1>
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-7rem)] flex-1 flex-col md:flex-row">
          <div className="max-h-64 w-full shrink-0 overflow-y-auto border-b border-gray-100 bg-white md:max-h-none md:h-auto md:w-80 md:border-b-0 md:border-r">
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
                  podePostar
                  podeReagir
                />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-gray-400">Selecione um canal</div>
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
