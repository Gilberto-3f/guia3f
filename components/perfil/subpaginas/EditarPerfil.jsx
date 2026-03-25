'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * @param {{
 *   usuarioId: string
 *   role: 'turista' | 'profissional' | 'admin'
 *   nomeInicial: string
 *   usernameInicial: string
 *   bioInicial: string
 *   onSalvo?: () => void
 * }} props
 */
export default function EditarPerfil({ usuarioId, role, nomeInicial, usernameInicial, bioInicial, onSalvo }) {
  const [nome, setNome] = useState(nomeInicial)
  const [username, setUsername] = useState(usernameInicial)
  const [bio, setBio] = useState(bioInicial)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    setNome(nomeInicial)
    setUsername(usernameInicial)
    setBio(bioInicial)
  }, [nomeInicial, usernameInicial, bioInicial])

  const tabela = role === 'profissional' ? 'profissionais' : 'turistas'

  const salvar = async () => {
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        nome_completo: nome.trim(),
        nome_usuario: username.trim().replace(/^@/, ''),
        bio: bio.trim() || null,
      }
      let error = null
      if (role === 'admin') {
        const { data: temTurista } = await supabase.from('turistas').select('usuario_id').eq('usuario_id', usuarioId).maybeSingle()
        const { data: temProf } = await supabase.from('profissionais').select('usuario_id').eq('usuario_id', usuarioId).maybeSingle()
        if (!temTurista && !temProf) {
          setMsg('Vincule um perfil turista ou profissional para editar dados aqui.')
          return
        }
        const tabelaAlvo = temTurista ? 'turistas' : 'profissionais'
        const res = await supabase.from(tabelaAlvo).update(payload).eq('usuario_id', usuarioId)
        error = res.error
      } else {
        const res = await supabase.from(tabela).update(payload).eq('usuario_id', usuarioId)
        error = res.error
      }

      if (error) {
        setMsg(error.message)
        return
      }
      setMsg('Perfil atualizado.')
      onSalvo?.()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="scrollbar-perfil max-h-[70vh] space-y-4 overflow-y-auto px-1 pb-4">
      <div>
        <label className="text-xs font-medium text-gray-500">Foto de perfil</label>
        <p className="mt-1 text-sm text-gray-400">Upload pelo fluxo de cadastro ou app — em breve aqui.</p>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Nome</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
          maxLength={120}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">@usuário</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
          className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
          maxLength={60}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Descrição</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="mt-1 min-h-[100px] w-full rounded-lg border border-gray-200 p-2 text-sm"
          maxLength={170}
          placeholder="Conte um pouco sobre você…"
        />
        <p className="text-right text-xs text-gray-400">{bio.length}/170</p>
      </div>
      {msg ? <p className="text-sm text-[#0097b2]">{msg}</p> : null}
      <button
        type="button"
        disabled={salvando}
        onClick={() => void salvar()}
        className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  )
}
