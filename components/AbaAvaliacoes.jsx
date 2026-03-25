'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import Estrelas from '@/components/Estrelas'
import EstrelasAvaliacao from '@/components/EstrelasAvaliacao'
import GraficoAvaliacoes from '@/components/GraficoAvaliacoes'
import { User } from 'lucide-react'

/**
 * @param {{ empresaId: string }} props
 */
export default function AbaAvaliacoes({ empresaId }) {
  const [avaliacoes, setAvaliacoes] = useState(
    /** @type {{ id: string, nota: number, comentario: string | null, created_at: string, avaliador_tipo: string, usuario_id: string, avaliador: { nome: string, username: string, foto_url: string | null } }[]} */ (
      []
    )
  )
  const [distribuicao, setDistribuicao] = useState(
    /** @type {Record<number, number>} */ ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
  )
  const [total, setTotal] = useState(0)
  const [media, setMedia] = useState(0)
  const [tipoFiltro, setTipoFiltro] = useState(/** @type {'todos' | 'turista' | 'profissional'} */ ('todos'))
  const [notaUsuario, setNotaUsuario] = useState(0)
  const [comentarioUsuario, setComentarioUsuario] = useState('')
  const [jaAvaliou, setJaAvaliou] = useState(false)
  const [avaliacaoId, setAvaliacaoId] = useState(/** @type {string | null} */ (null))
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [usuarioId, setUsuarioId] = useState(/** @type {string | null} */ (null))
  const [usuarioTipo, setUsuarioTipo] = useState(/** @type {string | null} */ (null))
  const [erro, setErro] = useState('')

  useEffect(() => {
    const getUsuario = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setUsuarioId(session.user.id)
        const { data: userData } = await supabase.from('usuarios').select('role').eq('id', session.user.id).single()
        setUsuarioTipo(userData?.role ?? null)
      }
    }
    getUsuario()
  }, [])

  const carregarAvaliacoes = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setErro('')
    try {
      const { data: avaliacoesData, error: qErr } = await supabase
        .from('avaliacoes')
        .select('id, nota, comentario, created_at, avaliador_tipo, usuario_id')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })

      if (qErr) {
        setErro(qErr.message)
        setAvaliacoes([])
        return
      }

      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      let soma = 0
      const completas = []

      for (const av of avaliacoesData || []) {
        soma += av.nota
        const k = /** @type {1|2|3|4|5} */ (av.nota)
        if (k >= 1 && k <= 5) dist[k] = (dist[k] || 0) + 1

        let nome = ''
        let username = ''
        let foto = null

        const { data: turista } = await supabase
          .from('turistas')
          .select('nome_completo, nome_usuario, foto_perfil_url')
          .eq('usuario_id', av.usuario_id)
          .maybeSingle()

        if (turista) {
          nome = turista.nome_completo
          username = turista.nome_usuario
          foto = turista.foto_perfil_url ?? null
        } else {
          const { data: profissional } = await supabase
            .from('profissionais')
            .select('nome_completo, nome_usuario, foto_perfil_url')
            .eq('usuario_id', av.usuario_id)
            .maybeSingle()

          if (profissional) {
            nome = profissional.nome_completo
            username = profissional.nome_usuario
            foto = profissional.foto_perfil_url ?? null
          }
        }

        if (!nome) {
          const { data: u } = await supabase.from('usuarios').select('email').eq('id', av.usuario_id).maybeSingle()
          nome = u?.email ? u.email.split('@')[0] : 'Usuário'
          username = nome
        }

        completas.push({
          id: av.id,
          nota: av.nota,
          comentario: av.comentario,
          created_at: av.created_at,
          avaliador_tipo: av.avaliador_tipo,
          usuario_id: av.usuario_id,
          avaliador: { nome, username, foto_url: foto },
        })
      }

      const totalCount = avaliacoesData?.length ?? 0
      setTotal(totalCount)
      setMedia(totalCount > 0 ? soma / totalCount : 0)
      setDistribuicao(dist)
      setAvaliacoes(completas)

      if (usuarioId) {
        const existente = avaliacoesData?.find((a) => a.usuario_id === usuarioId)
        if (existente) {
          setJaAvaliou(true)
          setAvaliacaoId(existente.id)
          setNotaUsuario(existente.nota)
          setComentarioUsuario(existente.comentario || '')
        } else {
          setJaAvaliou(false)
          setAvaliacaoId(null)
          setNotaUsuario(0)
          setComentarioUsuario('')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [empresaId, usuarioId])

  useEffect(() => {
    carregarAvaliacoes()
  }, [carregarAvaliacoes])

  const handleAvaliar = async () => {
    if (!usuarioId || notaUsuario === 0) return
    setEnviando(true)
    setErro('')
    try {
      if (jaAvaliou && avaliacaoId) {
        const { error } = await supabase
          .from('avaliacoes')
          .update({
            nota: notaUsuario,
            comentario: comentarioUsuario,
            updated_at: new Date().toISOString(),
          })
          .eq('id', avaliacaoId)
        if (error) {
          setErro(error.message)
          return
        }
      } else {
        const { error } = await supabase.from('avaliacoes').insert({
          empresa_id: empresaId,
          usuario_id: usuarioId,
          nota: notaUsuario,
          comentario: comentarioUsuario,
        })
        if (error) {
          setErro(error.message)
          return
        }
      }
      setJaAvaliou(true)
      await carregarAvaliacoes()
    } finally {
      setEnviando(false)
    }
  }

  const avaliacoesFiltradas = avaliacoes.filter((av) => {
    if (tipoFiltro === 'todos') return true
    return av.avaliador_tipo === tipoFiltro
  })

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-pulse text-gray-400">Carregando avaliações...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {erro ? <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">{erro}</p> : null}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-4">
          <div className="text-center">
            <span className="text-3xl font-bold text-gray-800">{media.toFixed(1)}</span>
            <Estrelas nota={media} tamanho={14} />
            <span className="block text-xs text-gray-500">
              {total} avaliação{total !== 1 ? 'ões' : ''}
            </span>
          </div>
          <div className="flex-1">
            <GraficoAvaliacoes distribuicao={distribuicao} total={total} />
          </div>
        </div>
      </div>

      {usuarioId && usuarioTipo !== 'empresa' && usuarioTipo !== 'admin' ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">
            {jaAvaliou ? 'Sua avaliação' : 'Avalie este estabelecimento'}
          </h3>
          <EstrelasAvaliacao nota={notaUsuario} onChange={setNotaUsuario} tamanho={28} />
          <textarea
            value={comentarioUsuario}
            onChange={(e) => setComentarioUsuario(e.target.value)}
            placeholder="Deixe seu comentário (opcional)"
            className="mt-3 w-full resize-none rounded-lg border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
            rows={3}
          />
          <button
            type="button"
            onClick={handleAvaliar}
            disabled={notaUsuario === 0 || enviando}
            className="mt-3 w-full rounded-lg bg-[#0097b2] py-2 font-medium text-white transition-colors hover:bg-[#007a91] disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : jaAvaliou ? 'Atualizar avaliação' : 'Enviar avaliação'}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTipoFiltro('todos')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tipoFiltro === 'todos' ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos ({avaliacoes.length})
        </button>
        <button
          type="button"
          onClick={() => setTipoFiltro('turista')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tipoFiltro === 'turista' ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Turistas ({avaliacoes.filter((a) => a.avaliador_tipo === 'turista').length})
        </button>
        <button
          type="button"
          onClick={() => setTipoFiltro('profissional')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tipoFiltro === 'profissional' ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Profissionais ({avaliacoes.filter((a) => a.avaliador_tipo === 'profissional').length})
        </button>
      </div>

      {avaliacoesFiltradas.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-400">
            {tipoFiltro === 'todos'
              ? 'Nenhuma avaliação ainda. Seja o primeiro a avaliar!'
              : `Nenhuma avaliação de ${tipoFiltro === 'turista' ? 'turistas' : 'profissionais'} ainda`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {avaliacoesFiltradas.map((av) => (
            <div key={av.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-3">
                {av.avaliador.foto_url ? (
                  <Image
                    src={av.avaliador.foto_url}
                    alt={av.avaliador.nome}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                    <User size={20} className="text-gray-400" aria-hidden />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-800">{av.avaliador.nome}</p>
                  <p className="text-xs text-gray-500">@{av.avaliador.username}</p>
                </div>
                <div className="ml-auto">
                  <Estrelas nota={av.nota} tamanho={14} />
                </div>
              </div>

              <div className="mb-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    av.avaliador_tipo === 'turista' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                  }`}
                >
                  {av.avaliador_tipo === 'turista' ? 'Turista' : 'Profissional'}
                </span>
              </div>

              {av.comentario ? <p className="text-sm text-gray-600">{av.comentario}</p> : null}

              <p className="mt-2 text-xs text-gray-400">
                {new Date(av.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
