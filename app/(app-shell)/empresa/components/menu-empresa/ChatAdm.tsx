'use client'

import { useEffect, useRef, useState } from 'react'
import { useDashboardEmpresa } from '@/app/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { useChatAdm } from '../../hooks/useChatAdm'

function formatHour(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatAdm() {
  const { dados: empresa } = useDashboardEmpresa()
  const { mensagens, loading, error, enviar } = useChatAdm(empresa?.id ?? null)

  const [novaMensagem, setNovaMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens.length])

  const onEnviar = async () => {
    const txt = novaMensagem.trim()
    if (!txt) return
    setEnviando(true)
    try {
      await enviar(txt)
      setNovaMensagem('')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-500">Carregando...</div>

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-800">
        Erro ao carregar chat: {error.message}
      </div>
    )
  }

  return (
    <div className="flex h-[520px] flex-col rounded-lg border bg-white">
      <div className="border-b bg-gray-50 p-4">
        <h3 className="font-bold text-[#001f3f]">💬 Chat com Administradores</h3>
        <p className="text-xs text-gray-500">Tempo de resposta: até 24h</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {mensagens.length === 0 ? (
          <div className="py-8 text-center text-gray-500">Nenhuma mensagem ainda. Inicie uma conversa!</div>
        ) : (
          <div className="space-y-3">
            {mensagens.map((msg) => {
              const isAdm = Boolean(msg.admin_id)
              return (
                <div key={msg.id} className={`flex ${isAdm ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-lg p-3 ${isAdm ? 'bg-gray-100 text-gray-800' : 'bg-[#0097b2] text-white'}`}>
                    {isAdm ? <p className="mb-1 text-xs font-medium">ADM: {msg.admin_email?.split('@')[0] ?? 'admin'}</p> : null}
                    <p className="text-sm">{msg.mensagem}</p>
                    <p className="mt-1 text-xs opacity-70">{formatHour(msg.created_at)}</p>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={novaMensagem}
            onChange={(e) => setNovaMensagem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onEnviar()
            }}
            placeholder="Digite sua mensagem..."
            className="flex-1 rounded-lg border p-2"
          />
          <button
            type="button"
            onClick={() => void onEnviar()}
            disabled={enviando || !novaMensagem.trim()}
            className="rounded-lg bg-[#0097b2] px-4 py-2 text-white disabled:opacity-50"
          >
            {enviando ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

