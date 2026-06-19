'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import ChatAdmEcossistema from '@/components/chat-adm/ChatAdmEcossistema'
import { roleParaMembroTipo, type MotivoEmergenciaEcossistema } from '@/lib/ecossistemaConversas'

function parseMotivoEmergencia(raw: string | null): MotivoEmergenciaEcossistema | null {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'socorro') return 'socorro'
  if (v === 'perdido') return 'perdido'
  if (v === 'item-esquecido' || v === 'item_esquecido') return 'item_esquecido'
  return null
}

function ChatAdmConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const motivoEmergencia = parseMotivoEmergencia(searchParams.get('motivo'))
  const urgente = searchParams.get('urgente') === '1' || motivoEmergencia != null
  const [gate, setGate] = useState<'loading' | 'forbidden' | 'ok'>('loading')
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!uid) {
        if (ativo) setGate('forbidden')
        return
      }
      const { data } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
      const role = data?.role != null ? String(data.role) : null
      if (!roleParaMembroTipo(role)) {
        if (ativo) setGate('forbidden')
        return
      }
      if (ativo) {
        setUsuarioId(uid)
        setGate('ok')
      }
    }
    void boot()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (gate !== 'forbidden') return
    router.push('/login')
  }, [gate, router])

  if (gate !== 'ok' || !usuarioId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-gray-500">{gate === 'loading' ? 'Carregando...' : 'Redirecionando...'}</div>
      </div>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3 bg-[#0097b2] px-2 pb-3 pt-safe text-white shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">Chat ADM</h1>
          <p className="truncate text-xs text-white/80">Mensageiro ECOSSISTEMA</p>
        </div>
      </header>
      <ChatAdmEcossistema
        usuarioId={usuarioId}
        urgenteInicial={urgente}
        motivoEmergencia={motivoEmergencia}
      />
    </>
  )
}

export default function ChatAdmPage() {
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Carregando...</div>
        }
      >
        <ChatAdmConteudo />
      </Suspense>
    </div>
  )
}
