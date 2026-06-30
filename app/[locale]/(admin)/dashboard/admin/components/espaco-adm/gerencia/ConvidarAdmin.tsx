'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'
import { COMUNIDADES_MODERADOR, FUNCOES_ADMIN_CONVITE } from '@/lib/adminConvites'

type UsuarioConvite = {
  id: string
  email?: string | null
  username?: string | null
  nome_completo?: string | null
  nome_exibicao?: string | null
  nome_usuario?: string | null
  role?: string | null
  admin_level?: number | null
}

type MensagemConvite = { tipo: 'sucesso' | 'erro'; texto: string }

export function ConvidarAdmin() {
  const { buscarUsuariosPorUsername, criarConvite, isAdminGeral } = useGerenciaAdm()
  const [username, setUsername] = useState('')
  const [nivel, setNivel] = useState<2 | 3 | 4>(2)
  const [comunidade, setComunidade] = useState('')
  const [resultados, setResultados] = useState<UsuarioConvite[]>([])
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState<MensagemConvite | null>(null)

  if (!isAdminGeral) return null

  const funcaoSelecionada = FUNCOES_ADMIN_CONVITE.find((f) => f.nivel === nivel)

  const handleBuscar = async () => {
    const q = username.trim().replace(/^@+/, '')
    if (q.length < 2) return
    setBuscando(true)
    setMensagem(null)
    try {
      const users = await buscarUsuariosPorUsername(q)
      setResultados(users)
      if (users.length === 0) {
        setMensagem({ tipo: 'erro', texto: 'Nenhum usuário encontrado com este username.' })
      }
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao buscar usuário.' })
    } finally {
      setBuscando(false)
    }
  }

  const handleConvidar = async (usuarioId: string, rotulo: string) => {
    if (nivel === 2 && !comunidade) {
      setMensagem({ tipo: 'erro', texto: 'Selecione a comunidade do moderador.' })
      return
    }
    setEnviando(true)
    setMensagem(null)
    try {
      await criarConvite(usuarioId, nivel, nivel === 2 ? comunidade : undefined)
      setMensagem({ tipo: 'sucesso', texto: `Convite enviado para @${rotulo}. O usuário verá um popup para aceitar ou recusar.` })
      setUsername('')
      setResultados([])
      setTimeout(() => setMensagem(null), 5000)
    } catch (e) {
      setMensagem({
        tipo: 'erro',
        texto: e instanceof Error ? e.message : 'Erro ao enviar convite.',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {mensagem ? (
        <div
          className={`rounded-lg p-2 text-xs ${
            mensagem.tipo === 'sucesso' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      <div>
        <label htmlFor="convite-admin-username" className="mb-1 block text-xs font-semibold text-gray-700">
          Username
        </label>
        <input
          id="convite-admin-username"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0097b2]"
          placeholder="Localize o username do usuário convidado"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleBuscar()
          }}
        />
      </div>

      <div>
        <label htmlFor="convite-admin-funcao" className="mb-1 block text-xs font-semibold text-gray-700">
          Função
        </label>
        <select
          id="convite-admin-funcao"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          value={nivel}
          onChange={(e) => setNivel(Number(e.target.value) as 2 | 3 | 4)}
        >
          {FUNCOES_ADMIN_CONVITE.map((f) => (
            <option key={f.nivel} value={f.nivel}>
              {f.label}
            </option>
          ))}
        </select>
        {funcaoSelecionada ? (
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{funcaoSelecionada.descricao}</p>
        ) : null}
      </div>

      {nivel === 2 ? (
        <div>
          <label htmlFor="convite-admin-comunidade" className="mb-1 block text-xs font-semibold text-gray-700">
            Comunidade
          </label>
          <select
            id="convite-admin-comunidade"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            value={comunidade}
            onChange={(e) => setComunidade(e.target.value)}
          >
            <option value="">Selecione a comunidade</option>
            {COMUNIDADES_MODERADOR.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          void handleBuscar()
        }}
        disabled={buscando || username.trim().replace(/^@+/, '').length < 2}
        className="inline-flex items-center gap-2 rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        {buscando ? 'Buscando…' : 'Buscar usuário'}
      </button>

      {resultados.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
          {resultados.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2">
              <div>
                <div className="font-semibold text-gray-900">@{u.username ?? u.nome_usuario ?? 'usuario'}</div>
                <div className="text-gray-500">{u.nome_exibicao ?? u.email ?? u.id.slice(0, 8)}</div>
              </div>
              <button
                type="button"
                disabled={enviando}
                onClick={() => {
                  void handleConvidar(u.id, u.username ?? u.nome_usuario ?? 'usuario')
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
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
