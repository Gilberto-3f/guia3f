'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { GUIA_CANAIS_BADGE_EVENT } from '@/lib/canais-badge-events'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useAnfitriaoModo } from '@/context/AnfitriaoModoContext'
import { useGuiaModo } from '@/context/GuiaModoContext'
import { useAdminColaboradorModo } from '@/context/AdminColaboradorModoContext'
import { colaboradorTemModoDual } from '@/lib/adminColaboradorModo'
import { anfitriaoUsaCanaisProfissionais } from '@/lib/anfitriaoDualMode'
import { guiaUsaCanaisProfissionais } from '@/lib/guiaDualMode'
import ListaCanais from '@/components/ListaCanais'
import ListaCanaisEmpresa from '@/components/ListaCanaisEmpresa'
import ListaCanaisProfissional from '@/components/ListaCanaisProfissional'
import CanalMensagens from '@/components/CanalMensagens'

type TipoUsuario = 'turista' | 'profissional' | 'empresa' | 'admin' | null

export default function CanalPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { modoAtivo, perfilSimulado, podeInteragir } = useModoApresentacao()
  const { refreshGate, userRole } = useProfissionalGate()
  const { ehAnfitriao } = useAnfitriaoModo()
  const { ehGuia } = useGuiaModo()
  const { emModoAdm, habilitado: modoColaboradorDual } = useAdminColaboradorModo()
  const [userTipo, setUserTipo] = useState<TipoUsuario>(null)
  const [adminLevel, setAdminLevel] = useState(0)
  const [loading, setLoading] = useState(true)
  const [turismoCanalId, setTurismoCanalId] = useState<string | null>(null)
  const [carregandoTurismo, setCarregandoTurismo] = useState(false)

  const userTipoEfetivo = useMemo((): TipoUsuario => {
    if (modoColaboradorDual && emModoAdm && colaboradorTemModoDual(adminLevel)) {
      return 'admin'
    }
    if (modoAtivo && perfilSimulado) {
      if (perfilSimulado.tipo === 'turista') return 'turista'
      if (perfilSimulado.tipo === 'profissional') return 'profissional'
      if (perfilSimulado.tipo === 'empresa') return 'empresa'
    }
    if (anfitriaoUsaCanaisProfissionais(userRole, ehAnfitriao)) return 'profissional'
    if (guiaUsaCanaisProfissionais(userRole, ehGuia)) return 'profissional'
    return userTipo
  }, [modoColaboradorDual, emModoAdm, adminLevel, modoAtivo, perfilSimulado, userTipo, userRole, ehAnfitriao, ehGuia])

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('role, admin_level')
        .eq('id', session.user.id)
        .maybeSingle()
      const role = userData?.role ?? null
      setAdminLevel(Number(userData?.admin_level ?? 0))

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
    if (userTipoEfetivo === 'empresa' || userTipoEfetivo === 'profissional') {
      void refreshGate()
    }
  }, [userTipoEfetivo, refreshGate])

  useEffect(() => {
    const onModo = () => {
      void refreshGate()
    }
    window.addEventListener('admin-colaborador-modo-change', onModo)
    return () => window.removeEventListener('admin-colaborador-modo-change', onModo)
  }, [refreshGate])

  /** Ao voltar da conversa para a lista, atualiza leituras e badge da barra. */
  useEffect(() => {
    if (!pathname) return
    const noDetalhe = /\/canal\/[^/]+/.test(pathname)
    const naLista = pathname.includes('/canal') && !noDetalhe
    if (naLista) {
      window.dispatchEvent(new Event(GUIA_CANAIS_BADGE_EVENT))
    }
  }, [pathname])

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
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <div className="sticky top-0 z-10 bg-[#0097b2] px-4 pb-3 pt-safe text-white shadow-sm">
          <h1 className="text-xl font-bold">Canal do turista</h1>
          <p className="text-sm text-white/85">Informações, promoções e dicas</p>
        </div>
        <div className="flex min-h-[calc(100dvh-8rem)] min-h-0 flex-1 flex-col">
          <CanalMensagens canalId={turismoCanalId} paisTab="geral" podePostar={false} podeReagir={podeInteragir} />
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'profissional') {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <div className="sticky top-0 z-10 bg-[#0097b2] px-4 pb-3 pt-safe text-white shadow-sm">
          <h1 className="text-xl font-bold">Profissional</h1>
        </div>
        <div className="flex min-h-0 min-h-[calc(100dvh-7rem)] flex-1 flex-col overflow-hidden">
          <ListaCanaisProfissional
            onSelectCanal={(c) => {
              if (!c?.id) return
              router.prefetch(`/canal/${c.id}`)
              router.push(`/canal/${c.id}`)
            }}
          />
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'empresa') {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <div className="sticky top-0 z-10 bg-[#0097b2] px-4 pb-3 pt-safe text-white shadow-sm">
          <h1 className="text-xl font-bold">Empresa</h1>
        </div>
        <div className="flex min-h-0 min-h-[calc(100dvh-7rem)] flex-1 flex-col overflow-hidden">
          <ListaCanaisEmpresa
            onSelectCanal={(c) => {
              if (!c?.id) return
              router.prefetch(`/canal/${c.id}`)
              router.push(`/canal/${c.id}`)
            }}
          />
        </div>
      </div>
    )
  }

  if (userTipoEfetivo === 'admin') {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <div className="sticky top-0 z-10 bg-[#0097b2] px-4 pb-3 pt-safe text-white shadow-sm">
          <h1 className="text-xl font-bold">Canais ADM</h1>
        </div>
        <div className="flex min-h-0 min-h-[calc(100dvh-7rem)] flex-1 flex-col overflow-y-auto">
          <ListaCanais
            tipoPublico={null}
            agruparPorTipo
            onSelectCanal={(c) => {
              if (!c?.id) return
              router.prefetch(`/canal/${c.id}`)
              router.push(`/canal/${c.id}`)
            }}
          />
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
