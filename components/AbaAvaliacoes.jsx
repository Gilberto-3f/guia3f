'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import Estrelas from '@/components/Estrelas'
import EstrelasAvaliacao from '@/components/EstrelasAvaliacao'
import GraficoAvaliacoes from '@/components/GraficoAvaliacoes'
import { MoreVertical, Share2, Trash2, Pencil, ShieldCheck, User } from 'lucide-react'

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
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [usuarioId, setUsuarioId] = useState(/** @type {string | null} */ (null))
  const [usuarioTipo, setUsuarioTipo] = useState(/** @type {string | null} */ (null))
  const [erroSalvarAvaliacao, setErroSalvarAvaliacao] = useState('')
  const [erroRespostaEmpresa, setErroRespostaEmpresa] = useState('')
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [menuAbertoId, setMenuAbertoId] = useState(/** @type {string | null} */ (null))
  const [modalEditarId, setModalEditarId] = useState(/** @type {string | null} */ (null))
  const [editNota, setEditNota] = useState(0)
  const [editFeedback, setEditFeedback] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [confirmExcluirId, setConfirmExcluirId] = useState(/** @type {string | null} */ (null))
  const [excluindo, setExcluindo] = useState(false)
  const [compartilhandoId, setCompartilhandoId] = useState(/** @type {string | null} */ (null))
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

  const carregarSeqRef = useRef(0)

  const carregarAvaliacoes = useCallback(async (opts) => {
    if (!empresaId) return
    const silent = Boolean(opts && opts.silent)
    const seq = ++carregarSeqRef.current
    if (!silent) setLoading(true)
    setErroSalvarAvaliacao('')
    setErroRespostaEmpresa('')
    try {
      const { data: avaliacoesData, error: qErr } = await supabase
        .from('avaliacoes')
        .select('id, nota, feedback, created_at, avaliador_tipo, usuario_id, alvo_id, alvo_tipo')
        .eq('alvo_id', empresaId)
        .eq('alvo_tipo', 'empresa')
        .order('created_at', { ascending: false })

      if (qErr) {
        console.error('[AbaAvaliacoes] carregar avaliacoes:', qErr.message)
        if (seq !== carregarSeqRef.current) return
        setAvaliacoes([])
        setTotal(0)
        setMedia(0)
        setDistribuicao({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
        if (usuarioId) {
          setJaAvaliou(false)
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

      if (seq !== carregarSeqRef.current) return

      const totalCount = rows.length
      setTotal(totalCount)
      setMedia(totalCount > 0 ? soma / totalCount : 0)
      setDistribuicao(dist)
      setAvaliacoes(completas)

      if (usuarioId) {
        const existente = rows.find((a) => a.usuario_id === usuarioId)
        if (existente) {
          setJaAvaliou(true)
          setNotaUsuario(0)
          setFeedbackUsuario('')
        } else {
          setJaAvaliou(false)
          setNotaUsuario(0)
          setFeedbackUsuario('')
        }
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [empresaId, usuarioId])

  useEffect(() => {
    carregarAvaliacoes()
  }, [carregarAvaliacoes])

  const executarSalvarAvaliacao = async () => {
    if (!usuarioId || notaUsuario === 0 || jaAvaliou) return
    setEnviando(true)
    setErroSalvarAvaliacao('')
    try {
      const avaliadorTipo = usuarioTipo === 'profissional' ? 'profissional' : 'turista'
      const { error } = await supabase.from('avaliacoes').insert({
        usuario_id: usuarioId,
        empresa_id: empresaId,
        alvo_id: empresaId,
        alvo_tipo: 'empresa',
        nota: notaUsuario,
        feedback: feedbackUsuario.trim() !== '' ? feedbackUsuario : null,
        avaliador_tipo: avaliadorTipo,
      })
      if (error) {
        setErroSalvarAvaliacao(error.message)
        return
      }
      setJaAvaliou(true)
      setNotaUsuario(0)
      setFeedbackUsuario('')
      setModalConfirmar(false)
      await carregarAvaliacoes({ silent: true })
      window.dispatchEvent(new CustomEvent('avaliacao-enviada', { detail: { empresaId } }))
      window.dispatchEvent(new Event('perfil-atualizado'))
    } finally {
      setEnviando(false)
    }
  }

  const abrirConfirmacaoEnvio = () => {
    if (!usuarioId || notaUsuario === 0 || enviando || jaAvaliou) return
    setModalConfirmar(true)
  }

  const abrirEdicao = (av) => {
    setMenuAbertoId(null)
    setErroSalvarAvaliacao('')
    setModalEditarId(av.id)
    setEditNota(Number(av.nota) || 0)
    setEditFeedback(av.feedback != null ? String(av.feedback) : '')
  }

  const salvarEdicao = async () => {
    if (!usuarioId || !modalEditarId) return
    if (!editNota || editNota < 1 || editNota > 5) return
    setSalvandoEdicao(true)
    setErroSalvarAvaliacao('')
    try {
      const feedbackSalvar = editFeedback.trim() !== '' ? editFeedback.trim() : null
      const { error } = await supabase
        .from('avaliacoes')
        .update({ nota: editNota, feedback: feedbackSalvar })
        .eq('id', String(modalEditarId))
        .eq('usuario_id', usuarioId)
      if (error) {
        setErroSalvarAvaliacao(error.message)
        return
      }

      const idStr = String(modalEditarId)
      setAvaliacoes((prev) => {
        const next = prev.map((a) =>
          String(a.id) === idStr ? { ...a, nota: editNota, feedback: feedbackSalvar } : a
        )
        const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        let soma = 0
        for (const a of next) {
          soma += Number(a.nota) || 0
          const k = /** @type {1 | 2 | 3 | 4 | 5} */ (Number(a.nota))
          if (k >= 1 && k <= 5) dist[k] = (dist[k] || 0) + 1
        }
        const totalCount = next.length
        setDistribuicao(dist)
        setTotal(totalCount)
        setMedia(totalCount > 0 ? soma / totalCount : 0)
        return next
      })

      setModalEditarId(null)
      window.dispatchEvent(new CustomEvent('avaliacao-enviada', { detail: { empresaId } }))
      window.dispatchEvent(new Event('perfil-atualizado'))
    } finally {
      setSalvandoEdicao(false)
    }
  }

  const excluirAvaliacao = async () => {
    if (!usuarioId || !confirmExcluirId) return
    setExcluindo(true)
    try {
      const { error } = await supabase
        .from('avaliacoes')
        .delete()
        .eq('id', confirmExcluirId)
        .eq('usuario_id', usuarioId)
        .eq('alvo_id', empresaId)
        .eq('alvo_tipo', 'empresa')
      if (error) {
        setErroSalvarAvaliacao(error.message)
        return
      }
      setConfirmExcluirId(null)
      setJaAvaliou(false)
      await carregarAvaliacoes({ silent: true })
      window.dispatchEvent(new CustomEvent('avaliacao-enviada', { detail: { empresaId } }))
      window.dispatchEvent(new Event('perfil-atualizado'))
    } finally {
      setExcluindo(false)
    }
  }

  const compartilharNoFeed = async (av) => {
    if (!usuarioId) return
    setMenuAbertoId(null)
    setCompartilhandoId(av.id)
    try {
      const { data: emp } = await supabase
        .from('empresas')
        .select('id, nome_fantasia, nome_usuario, foto_url')
        .eq('id', empresaId)
        .maybeSingle()
      const handleEmp =
        emp?.nome_usuario != null && String(emp.nome_usuario).trim() !== ''
          ? String(emp.nome_usuario).trim().replace(/^@+/, '')
          : null
      /** Foto e nomes atualizados no feed via `PostCard` (consulta `empresas` por `empresa_id`). */
      const meta = {
        empresa_id: String(emp?.id ?? empresaId),
        nome_fantasia: emp?.nome_fantasia != null ? String(emp.nome_fantasia) : 'Empresa',
        nome_usuario: handleEmp,
        nota: Number(av.nota) || 0,
        feedback: av.feedback != null ? String(av.feedback) : null,
      }
      const { error } = await supabase.from('posts').insert({
        autor_id: usuarioId,
        tipo: 'avaliacao',
        texto: null,
        foto_url: null,
        conteudo_url: null,
        avaliacao_meta: meta,
      })
      if (error) {
        setErroSalvarAvaliacao(error.message)
        return
      }
      window.dispatchEvent(new Event('guia-feed-rede-reload'))
    } finally {
      setCompartilhandoId(null)
    }
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
      await carregarAvaliacoes({ silent: true })
    } finally {
      setSavingReply(false)
    }
  }

  const avaliacoesFiltradas = avaliacoes.filter((av) => av.avaliador_tipo === tipoFiltro)

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
          <div className="mb-6 flex items-center justify-center gap-2 sm:justify-start">
            <ShieldCheck className="h-8 w-8 shrink-0 text-[#00D443] sm:h-9 sm:w-9" aria-hidden />
            <h3 className="text-base font-bold leading-tight text-gray-900 sm:text-lg">Empresa de Confiança</h3>
          </div>
        ) : null}

        <div className="grid grid-cols-2 items-center gap-3 sm:gap-4">
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-4xl font-bold text-[#0097b2]">{total > 0 ? media.toFixed(1).replace('.', ',') : '—'}</p>
            <p className="mt-1 text-sm text-gray-500">
              ({total} {total === 1 ? 'avaliação' : 'avaliações'})
            </p>
          </div>
          <div className="min-w-0">
            <GraficoAvaliacoes distribuicao={distribuicao} total={total} compact />
          </div>
        </div>
      </div>

      {usuarioId && usuarioTipo !== 'empresa' && usuarioTipo !== 'admin' ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-center text-lg font-semibold text-gray-900">
            {jaAvaliou ? 'Sua avaliação' : 'Faça sua avaliação'}
          </h3>
          {jaAvaliou ? (
            <p className="mb-4 text-center text-sm text-gray-700">Você já avaliou esta empresa.</p>
          ) : null}
          <div className="flex justify-center">
            <EstrelasAvaliacao
              nota={jaAvaliou ? 0 : notaUsuario}
              onChange={(n) => {
                setNotaUsuario(n)
                setErroSalvarAvaliacao('')
              }}
              tamanho={40}
              disabled={jaAvaliou}
            />
          </div>
          {!jaAvaliou && notaUsuario > 0 ? (
            <div className="mt-4">
              <textarea
                value={feedbackUsuario}
                onChange={(e) => {
                  setFeedbackUsuario(e.target.value)
                  setErroSalvarAvaliacao('')
                }}
                placeholder="Compartilhe sua experiência (opcional)"
                className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
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

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setTipoFiltro('profissional')}
          className={`flex-1 rounded-md py-2 text-center text-sm font-semibold transition-colors ${
            tipoFiltro === 'profissional'
              ? 'bg-[#0097b2] text-white shadow-sm'
              : 'text-[#0097b2] hover:bg-white/60'
          }`}
        >
          Profissionais ({avaliacoes.filter((a) => a.avaliador_tipo === 'profissional').length})
        </button>
        <button
          type="button"
          onClick={() => setTipoFiltro('turista')}
          className={`flex-1 rounded-md py-2 text-center text-sm font-semibold transition-colors ${
            tipoFiltro === 'turista' ? 'bg-[#0097b2] text-white shadow-sm' : 'text-[#0097b2] hover:bg-white/60'
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
                {usuarioId && av.usuario_id === usuarioId ? (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      aria-label="Ações da avaliação"
                      onClick={() => setMenuAbertoId((cur) => (cur === av.id ? null : av.id))}
                    >
                      <MoreVertical size={18} aria-hidden />
                    </button>
                    {menuAbertoId === av.id ? (
                      <div className="absolute right-0 top-9 z-[120] w-56 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                          onClick={() => abrirEdicao(av)}
                        >
                          <Pencil size={16} aria-hidden />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                          onClick={() => {
                            setMenuAbertoId(null)
                            setConfirmExcluirId(av.id)
                          }}
                        >
                          <Trash2 size={16} aria-hidden />
                          Excluir
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                          onClick={() => void compartilharNoFeed(av)}
                          disabled={compartilhandoId === av.id}
                        >
                          <Share2 size={16} aria-hidden />
                          {compartilhandoId === av.id ? 'Compartilhando…' : 'Compartilhar no feed'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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

      {modalEditarId ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-center text-lg font-bold text-gray-900">Editar avaliação</h3>
            <div className="mt-4 flex justify-center">
              <EstrelasAvaliacao
                nota={editNota}
                onChange={(n) => {
                  setEditNota(n)
                  setErroSalvarAvaliacao('')
                }}
              />
            </div>
            <textarea
              className="mt-4 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
              rows={4}
              value={editFeedback}
              onChange={(e) => {
                setEditFeedback(e.target.value)
                setErroSalvarAvaliacao('')
              }}
              placeholder="Atualize seu feedback (opcional)"
            />
            {erroSalvarAvaliacao ? <p className="mt-2 text-center text-sm text-red-600">{erroSalvarAvaliacao}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setModalEditarId(null)
                  setErroSalvarAvaliacao('')
                }}
                disabled={salvandoEdicao}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-[#0097b2] py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                onClick={() => void salvarEdicao()}
                disabled={salvandoEdicao || !editNota}
              >
                {salvandoEdicao ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmExcluirId ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-center text-lg font-bold text-gray-900">Excluir avaliação</h3>
            <p className="mt-2 text-center text-sm text-gray-600">Tem certeza que deseja excluir sua avaliação?</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setConfirmExcluirId(null)}
                disabled={excluindo}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => void excluirAvaliacao()}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
