'use client'

import { useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'
import {
  COMUNIDADES_MODERADOR,
  FUNCOES_ADMIN_CONVITE,
  PAISES_MODERADOR,
} from '@/lib/adminConvites'
import { CardUsuarioConvite } from './CardUsuarioConvite'

type UsuarioConvite = {
  id: string
  username: string
  nome_social: string
  foto_url: string | null
}

type MensagemConvite = { tipo: 'sucesso' | 'erro'; texto: string }

const COR_LOGO = '#0097b2'

export function ConvidarAdmin() {
  const { buscarUsuarioExato, criarConvite, isAdminGeral } = useGerenciaAdm()
  const [termo, setTermo] = useState('')
  const [nivel, setNivel] = useState<2 | 3 | 4>(2)
  const [comunidade, setComunidade] = useState('')
  const [pais, setPais] = useState('')
  const [usuario, setUsuario] = useState<UsuarioConvite | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState<MensagemConvite | null>(null)

  if (!isAdminGeral) return null

  const funcaoSelecionada = FUNCOES_ADMIN_CONVITE.find((f) => f.nivel === nivel)

  const handleBuscar = async () => {
    const q = termo.trim().replace(/^@+/, '')
    if (q.length < 2) return
    setBuscando(true)
    setMensagem(null)
    setUsuario(null)
    try {
      const u = await buscarUsuarioExato(q)
      if (!u) {
        setMensagem({ tipo: 'erro', texto: 'Nenhum usuário encontrado com este nome ou username.' })
        return
      }
      setUsuario(u)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao buscar usuário.' })
    } finally {
      setBuscando(false)
    }
  }

  const handleConvidar = async () => {
    if (!usuario) return
    if (nivel === 2 && !comunidade) {
      setMensagem({ tipo: 'erro', texto: 'Selecione a comunidade do moderador.' })
      return
    }
    if (nivel === 2 && !pais) {
      setMensagem({ tipo: 'erro', texto: 'Selecione o país do moderador.' })
      return
    }
    setEnviando(true)
    setMensagem(null)
    try {
      await criarConvite(
        usuario.id,
        nivel,
        nivel === 2 ? comunidade : undefined,
        nivel === 2 ? pais : undefined,
      )
      setMensagem({
        tipo: 'sucesso',
        texto: `Convite enviado para @${usuario.username}. O usuário verá um popup para aceitar ou recusar.`,
      })
      setTermo('')
      setUsuario(null)
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
        <label htmlFor="convite-admin-termo" className="mb-1 block text-xs font-semibold text-gray-700">
          Nome ou Username
        </label>
        <input
          id="convite-admin-termo"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-[#0097b2]"
          placeholder="Nome social ou @username (busca exata)"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
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
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
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
        <>
          <div>
            <label htmlFor="convite-admin-comunidade" className="mb-1 block text-xs font-semibold text-gray-700">
              Comunidade
            </label>
            <select
              id="convite-admin-comunidade"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
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
          <div>
            <label htmlFor="convite-admin-pais" className="mb-1 block text-xs font-semibold text-gray-700">
              País
            </label>
            <select
              id="convite-admin-pais"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              value={pais}
              onChange={(e) => setPais(e.target.value)}
            >
              <option value="">Selecione o país</option>
              {PAISES_MODERADOR.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => void handleBuscar()}
          disabled={buscando || termo.trim().replace(/^@+/, '').length < 2}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: COR_LOGO }}
        >
          <Search className="h-4 w-4" aria-hidden />
          {buscando ? 'Buscando…' : 'Buscar usuário'}
        </button>
      </div>

      {usuario ? (
        <div className="space-y-4 pt-2">
          <CardUsuarioConvite
            nomeSocial={usuario.nome_social}
            username={usuario.username}
            fotoUrl={usuario.foto_url}
          />
          <div className="flex justify-center">
            <button
              type="button"
              disabled={enviando}
              onClick={() => void handleConvidar()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00D443] px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4 text-white" strokeWidth={2.25} aria-hidden />
              {enviando ? 'Enviando…' : 'CONVIDAR'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
