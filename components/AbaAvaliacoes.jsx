'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import Estrelas from '@/components/Estrelas'
import EstrelasAvaliacao from '@/components/EstrelasAvaliacao'
import GraficoAvaliacoes from '@/components/GraficoAvaliacoes'
import { CheckCircle2, Star, User } from 'lucide-react'

/** Média exibida nas estrelas grandes: arredondamento clássico (0,5 → inteiro mais próximo). */
function notaParaEstrelasGrandes(media, total) {
  if (!total || !Number.isFinite(media)) return 0
  return Math.min(5, Math.max(0, Math.round(media)))
}

/**
 * @param {{ notaExibicao: number, tamanho?: number }} props
 */
function EstrelasGrandesLeitura({ notaExibicao, tamanho = 44 }) {
  return (
    <div className="flex justify-center gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((v) => (
        <Star
          key={v}
          size={tamanho}
          className={v <= notaExibicao ? 'fill-[#0097b2] text-[#0097b2]' : 'text-gray-200'}
        />
      ))}
    </div>
  )
}

/**
 * @param {{
 *   empresaId: string
 *   empresaVerificada?: boolean
 *   podeResponder?: boolean
 *   empresaUsuarioId?: string | null
 * }} props
 */
export default function AbaAvaliacoes({
  empresaId,
  empresaVerificada = false,
  podeResponder = false,
  empresaUsuarioId = null,
}) {
  const [avaliacoes, setAvaliacoes] = useState(
    /** @type {{ id: string, nota: number, feedback: string | null, created_at: string, avaliador_tipo: string, usuario_id: string, avaliador: { nome: string, username: string, foto_url: string | null }, resposta: { id: string, texto: string } | null }[]} */ (
      []
    )
  )
  const [distribuicao, setDistribuicao] = useState(
    /** @type {Record<number, number>} */ ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
  )
  const [total, setTotal] = useState(0)
  const [media, setMedia] = useState(0)
  const [tipoFiltro, setTipoFiltro] = useState(/** @type {'turista' | 'profissional'} */ ('profissional'))
  const [notaUsuario, setNotaUsuario] = useState(0)
  const [feedbackUsuario, setFeedbackUsuario] = useState('')
  const [jaAvaliou, setJaAvaliou] = useState(false)
  const [avaliacaoId, setAvaliacaoId] = useState(/** @type {string | null} */ (null))
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [usuarioId, setUsuarioId] = useState(/** @type {string | null} */ (null))
  const [usuarioTipo, setUsuarioTipo] = useState(/** @type {string | null} */ (null))
  const [erroSalvarAvaliacao, setErroSalvarAvaliacao] = useState('')
  const [erroRespostaEmpresa, setErroRespostaEmpresa] = useState('')
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [editingReplyAvaliacaoId, setEditingReplyAvaliacaoId] = useState(/** @type {string | null} */ (null))
  const [replyDraft, setReplyDraft] = useState('')
  const [savingReply, setSavingReply] = useState(false)

  useEffect(() => {
    const getUsuario = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setUsuarioId(session.user.id)
        const { data: userData } = await supabase.from('usuarios').select('role').eq('id', session.user.id).maybeSingle()
        setUsuarioTipo(userData?.role ?? null)
      }
    }
    getUsuario()
  }, [])

  const carregarAvaliacoes = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setErroSalvarAvaliacao('')
    setErroRespostaEmpresa('')
    try {
      const { data: avaliacoesData, error: qErr } = await supabase
        .from('avaliacoes')
        .select('id, nota, feedback, created_at, avaliador_tipo, usuario_id')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })

      if (qErr) {
        console.error('[AbaAvaliacoes] carregar avaliacoes:', qErr.message)
        setAvaliacoes([])
        setTotal(0)
        setMedia(0)
        setDistribuicao({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
        if (usuarioId) {
          setJaAvaliou(false)
          setAvaliacaoId(null)
          setNotaUsuario(0)
          setFeedbackUsuario('')
        }
        return
      }

      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      let soma = 0
      const rows = avaliacoesData || []

      for (const av of rows) {
        soma += av.nota
        const k = /** @type {1|2|3|4|5} */ (av.nota)
        if (k >= 1 && k <= 5) dist[k] = (dist[k] || 0) + 1
      }

      const uids = [...new Set(rows.map((r) => r.usuario_id).filter(Boolean))]
      /** @type {Map<string, { nome: string, username: string, foto: string | null }>} */
      const perfilPorUsuario = new Map()

      if (uids.length) {
        const [turRes, profRes, usrRes] = await Promise.all([
          supabase.from('turistas').select('usuario_id, nome_completo, nome_usuario, foto_perfil_url').in('usuario_id', uids),
          supabase.from('profissionais').select('usuario_id, nome_completo, nome_usuario, foto_perfil_url').in('usuario_id', uids),
          supabase.from('usuarios').select('id, email').in('id', uids),
        ])

        for (const t of turRes.data || []) {
          const uid = String(t.usuario_id)
          perfilPorUsuario.set(uid, {
            nome: String(t.nome_completo ?? ''),
            username: String(t.nome_usuario ?? ''),
            foto: t.foto_perfil_url ?? null,
          })
        }
        for (const p of profRes.data || []) {
          const uid = String(p.usuario_id)
          if (!perfilPorUsuario.has(uid)) {
            perfilPorUsuario.set(uid, {
              nome: String(p.nome_completo ?? ''),
              username: String(p.nome_usuario ?? ''),
              foto: p.foto_perfil_url ?? null,
            })
          }
        }
        const emailPorId = new Map()
        for (const u of usrRes.data || []) {
          emailPorId.set(String(u.id), u.email != null ? String(u.email) : '')
        }
        for (const uid of uids) {
          if (perfilPorUsuario.has(uid)) continue
          const email = emailPorId.get(uid) || ''
          const stub = email ? email.split('@')[0] : 'Usuário'
          perfilPorUsuario.set(uid, { nome: stub, username: stub, foto: null })
        }
      }

      /** @type {Map<string, { id: string, texto: string }>} */
      const respostaPorAvaliacao = new Map()
      if (rows.length) {
        const aids = rows.map((r) => r.id)
        const { data: respRows, error: respErr } = await supabase
          .from('avaliacao_respostas')
          .select('id, avaliacao_id, texto')
          .in('avaliacao_id', aids)
          .eq('empresa_id', empresaId)

        if (!respErr && respRows) {
          for (const r of respRows) {
            respostaPorAvaliacao.set(String(r.avaliacao_id), { id: String(r.id), texto: String(r.texto ?? '') })
          }
        }
      }

      const completas = rows.map((av) => {
        const uid = String(av.usuario_id)
        const perf = perfilPorUsuario.get(uid) || { nome: 'Usuário', username: 'usuario', foto: null }
        return {
          id: av.id,
          nota: av.nota,
          feedback: av.feedback,
          created_at: av.created_at,
          avaliador_tipo: av.avaliador_tipo,
          usuario_id: av.usuario_id,
          avaliador: { nome: perf.nome, username: perf.username, foto_url: perf.foto },
          resposta: respostaPorAvaliacao.get(String(av.id)) ?? null,
        }
      })

      const totalCount = rows.length
      setTotal(totalCount)
      setMedia(totalCount > 0 ? soma / totalCount : 0)
      setDistribuicao(dist)
      setAvaliacoes(completas)

      if (usuarioId) {
        const existente = rows.find((a) => a.usuario_id === usuarioId)
        if (existente) {
          setJaAvaliou(true)
          setAvaliacaoId(existente.id)
          setNotaUsuario(existente.nota)
          setFeedbackUsuario(existente.feedback || '')
        } else {
          setJaAvaliou(false)
          setAvaliacaoId(null)
          setNotaUsuario(0)
          setFeedbackUsuario('')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [empresaId, usuarioId])

  useEffect(() => {
    carregarAvaliacoes()
  }, [carregarAvaliacoes])

  const executarSalvarAvaliacao = async () => {
    if (!usuarioId || notaUsuario === 0) return
    setEnviando(true)
    setErroSalvarAvaliacao('')
    try {
      if (jaAvaliou && avaliacaoId) {
        const { error } = await supabase
          .from('avaliacoes')
          .update({
            nota: notaUsuario,
            feedback: feedbackUsuario,
            updated_at: new Date().toISOString(),
          })
          .eq('id', avaliacaoId)
        if (error) {
          setErroSalvarAvaliacao(error.message)
          return
        }
      } else {
        const { error } = await supabase.from('avaliacoes').insert({
          empresa_id: empresaId,
          usuario_id: usuarioId,
          nota: notaUsuario,
          feedback: feedbackUsuario,
        })
        if (error) {
          setErroSalvarAvaliacao(error.message)
          return
        }
      }
      setJaAvaliou(true)
      setModalConfirmar(false)
      await carregarAvaliacoes()
    } finally {
      setEnviando(false)
    }
  }

  const abrirConfirmacaoEnvio = () => {
    if (!usuarioId || notaUsuario === 0 || enviando) return
    setModalConfirmar(true)
  }

  const publicarResposta = async (avaliacaoIdParam) => {
    if (!podeResponder || !usuarioId || !empresaUsuarioId || usuarioId !== empresaUsuarioId) {
      setErroRespostaEmpresa('Apenas o dono da empresa pode publicar uma resposta.')
      return
    }
    const texto = replyDraft.trim()
    if (!texto) {
      setErroRespostaEmpresa('Escreva uma resposta antes de publicar.')
      return
    }
    setSavingReply(true)
    setErroRespostaEmpresa('')
    try {
      const { error } = await supabase.from('avaliacao_respostas').upsert(
        {
          avaliacao_id: avaliacaoIdParam,
          empresa_id: empresaId,
          autor_usuario_id: usuarioId,
          texto,
        },
        { onConflict: 'avaliacao_id' }
      )
      if (error) {
        setErroRespostaEmpresa(error.message)
        return
      }
      setEditingReplyAvaliacaoId(null)
      setReplyDraft('')
      await carregarAvaliacoes()
    } finally {
      setSavingReply(false)
    }
  }

  const avaliacoesFiltradas = avaliacoes.filter((av) => av.avaliador_tipo === tipoFiltro)

  const estrelasMediaGrande = notaParaEstrelasGrandes(media, total)

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-pulse text-gray-400">Carregando avaliações...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {modalConfirmar ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-avaliacao-titulo"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="confirmar-avaliacao-titulo" className="text-center text-lg font-bold text-gray-900">
              Confirmar avaliação
            </h2>
            <p className="mt-3 text-center text-sm text-gray-600">
              Confirmar avaliação com <span className="font-semibold text-[#0097b2]">{notaUsuario}</span>{' '}
              {notaUsuario === 1 ? 'estrela' : 'estrelas'}?
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setModalConfirmar(false)}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#0097b2] py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                onClick={() => void executarSalvarAvaliacao()}
                disabled={enviando}
              >
                {enviando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        {empresaVerificada ? (
          <div className="mb-6 flex items-center justify-center gap-3 sm:justify-start">
            <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-600" aria-hidden />
            <h3 className="text-xl font-bold text-gray-900">Empresa de Confiança</h3>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:items-center">
          <div>
            <p className="text-center text-5xl font-extrabold text-[#0097b2] sm:text-left sm:text-6xl">
              {total > 0 ? media.toFixed(1).replace('.', ',') : '—'}
            </p>
            <div className="mt-2 flex justify-center sm:justify-start">
              <EstrelasGrandesLeitura notaExibicao={estrelasMediaGrande} />
            </div>
            <p className="mt-2 text-center text-sm text-gray-500 sm:text-left">
              ({total} {total === 1 ? 'avaliação' : 'avaliações'})
            </p>
          </div>
          <div className="w-full min-w-0">
            <GraficoAvaliacoes distribuicao={distribuicao} total={total} />
          </div>
        </div>
      </div>

      {usuarioId && usuarioTipo !== 'empresa' && usuarioTipo !== 'admin' ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-center text-lg font-semibold text-gray-900">Faça sua avaliação</h3>
          <div className="flex justify-center">
            <EstrelasAvaliacao
              nota={notaUsuario}
              onChange={(n) => {
                setNotaUsuario(n)
                setErroSalvarAvaliacao('')
              }}
              tamanho={40}
            />
          </div>
          {notaUsuario > 0 ? (
            <div className="mt-4">
              <textarea
                value={feedbackUsuario}
                onChange={(e) => {
                  setFeedbackUsuario(e.target.value)
                  setErroSalvarAvaliacao('')
                }}
                placeholder="Deixe seu feedback (opcional)"
                className="w-full resize-none rounded-lg border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                rows={3}
              />
              {erroSalvarAvaliacao ? <p className="mt-2 text-center text-sm text-red-600">{erroSalvarAvaliacao}</p> : null}
              <button
                type="button"
                onClick={abrirConfirmacaoEnvio}
                disabled={enviando}
                className="mt-3 w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-95 disabled:opacity-50"
                style={{ backgroundColor: '#00D443' }}
              >
                Enviar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTipoFiltro('profissional')}
          className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
            tipoFiltro === 'profissional' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Profissionais ({avaliacoes.filter((a) => a.avaliador_tipo === 'profissional').length})
        </button>
        <button
          type="button"
          onClick={() => setTipoFiltro('turista')}
          className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
            tipoFiltro === 'turista' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Turistas ({avaliacoes.filter((a) => a.avaliador_tipo === 'turista').length})
        </button>
      </div>

      {avaliacoesFiltradas.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-400">
            {`Nenhuma avaliação de ${tipoFiltro === 'turista' ? 'turistas' : 'profissionais'} ainda`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {avaliacoesFiltradas.map((av) => (
            <div key={av.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
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
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">{av.avaliador.nome}</p>
                  <p className="truncate text-xs text-gray-500">@{av.avaliador.username}</p>
                </div>
                <div className="shrink-0">
                  <Estrelas nota={av.nota} tamanho={14} />
                </div>
              </div>

              {av.feedback ? (
                <blockquote className="border-l-4 border-[#0097b2]/40 py-1 pl-3 text-sm leading-relaxed text-gray-700">
                  {av.feedback}
                </blockquote>
              ) : null}

              {av.resposta ? (
                <div className="mt-3 rounded-r-lg border border-slate-100 bg-slate-50 py-2 pr-3 pl-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0097b2]">Resposta da empresa</p>
                  <p className="mt-1 text-sm text-gray-700">{av.resposta.texto}</p>
                </div>
              ) : null}

              {podeResponder ? (
                <div className="mt-3">
                  {editingReplyAvaliacaoId === av.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyDraft}
                        onChange={(e) => {
                          setReplyDraft(e.target.value)
                          setErroRespostaEmpresa('')
                        }}
                        placeholder="Resposta visível para usuários autenticados"
                        className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                        rows={3}
                      />
                      {erroRespostaEmpresa ? <p className="text-sm text-red-600">{erroRespostaEmpresa}</p> : null}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                          onClick={() => {
                            setEditingReplyAvaliacaoId(null)
                            setReplyDraft('')
                            setErroRespostaEmpresa('')
                          }}
                          disabled={savingReply}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-lg bg-[#0097b2] py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                          onClick={() => void publicarResposta(av.id)}
                          disabled={savingReply}
                        >
                          {savingReply ? 'Publicando...' : 'Publicar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-semibold text-[#0097b2] hover:underline"
                      onClick={() => {
                        setEditingReplyAvaliacaoId(av.id)
                        setReplyDraft(av.resposta?.texto ?? '')
                        setErroRespostaEmpresa('')
                      }}
                    >
                      {av.resposta ? 'Editar resposta' : 'Responder'}
                    </button>
                  )}
                </div>
              ) : null}

              <p className="mt-3 text-xs text-gray-400">
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
