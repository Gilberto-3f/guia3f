'use client'

import { useState } from 'react'
import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'

export function ConvidarAdmin() {
  const { buscarUsuariosPorEmail, criarConvite, isAdminGeral } = useGerenciaAdm()
  const [email, setEmail] = useState('')
  const [nivel, setNivel] = useState(2)
  const [comunidade, setComunidade] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  if (!isAdminGeral) return null

  const handleBuscar = async () => {
    if (email.trim().length < 3) return
    setBuscando(true)
    try {
      const users = await buscarUsuariosPorEmail(email.trim())
      setResultados(users)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao buscar usuário.' })
    } finally {
      setBuscando(false)
    }
  }

  const handleConvidar = async (usuarioEmail: string) => {
    try {
      await criarConvite(usuarioEmail, nivel, nivel === 2 ? comunidade : undefined)
      setMensagem({ tipo: 'sucesso', texto: `Convite enviado para ${usuarioEmail}` })
      setEmail('')
      setResultados([])
      setTimeout(() => setMensagem(null), 3000)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao enviar convite.' })
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
      <div className="text-sm font-bold text-gray-900">Convidar novo admin</div>

      {mensagem ? (
        <div
          className={`mt-2 rounded-lg p-2 text-xs ${
            mensagem.tipo === 'sucesso' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0097b2]"
          placeholder="Buscar usuário por email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          value={nivel}
          onChange={(e) => setNivel(Number(e.target.value))}
        >
          <option value={2}>Moderador</option>
          <option value={3}>Financeiro</option>
          <option value={4}>Suporte</option>
        </select>
      </div>

      {nivel === 2 ? (
        <select
          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
          value={comunidade}
          onChange={(e) => setComunidade(e.target.value)}
        >
          <option value="">Comunidade (opcional)</option>
          <option value="guias">Guias</option>
          <option value="taxistas">Taxistas</option>
          <option value="apps">Apps</option>
          <option value="vans">Vans</option>
          <option value="anfitrioes">Anfitriões</option>
        </select>
      ) : null}

      <button
        type="button"
        onClick={handleBuscar}
        disabled={buscando || email.trim().length < 3}
        className="mt-3 rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {buscando ? 'Buscando...' : 'Buscar usuário'}
      </button>

      {resultados.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-white p-3 text-xs">
          {resultados.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-gray-900">{u.nome_completo ?? u.email}</div>
                <div className="text-gray-500">{u.email}</div>
              </div>
              <button
                type="button"
                onClick={() => handleConvidar(u.email)}
                className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
              >
                Convidar
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

