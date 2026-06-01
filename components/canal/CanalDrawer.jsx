'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import {
  ArrowLeft,
  Bookmark,
  Flag,
  ImageIcon,
  MoreHorizontal,
  Search,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useContagemMembrosCanais } from '@/hooks/useContagemMembrosCanais'
import { canalExibeContagemMembros, formatarLegendaMembrosCanal } from '@/lib/canalMembrosContagem'

/** @typedef {import('@/lib/canalMembrosContagem').CanalMembrosRow} CanalMembrosRow */
import {
  iconeCanalProfissionalLista,
  CLASSE_AVATAR_CANAL_PROFISSIONAL,
  CLASSE_AVATAR_CANAL_ADMINISTRACAO,
} from '@/lib/canaisProfissionaisListaUi'
import { isCanalAdmProfissionalGlobal } from '@/lib/canaisProfissionalSlugs'
import { listarMidiaCanal } from '@/lib/canalMidiaHistorico'
import { buscarMensagensCanalPorTexto } from '@/lib/canalMensagensBusca'
import { enviarDenunciaMensagemCanal, listarDenunciasCanalDoUsuario } from '@/lib/canalDenuncias'
import { buscarRemetentesEmLote } from '@/lib/canalRemetentes'
import { ehAnexoAudioCanal, ehAnexoImagemCanal } from '@/lib/canalAnexoUrl'
import CanalMensagemImagem from '@/components/CanalMensagemImagem'
import CanalMensagemAudio from '@/components/CanalMensagemAudio'
import ModalDenunciaCanal from '@/components/canal/ModalDenunciaCanal'
import AvatarImage from '@/components/AvatarImage'

/** @typedef {'info' | 'midia' | 'buscar' | 'salvos' | 'mais'} AbaDrawerCanal */

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   canalId: string
 *   canal: CanalMembrosRow & { empresas?: { foto_url?: string | null } | null }
 *   tituloCanal: string
 *   usuarioId: string | null
 *   paisTab?: string
 *   modoFiltroPais?: import('@/lib/canalAbasPaisColetivo').ModoFiltroPaisCanal
 *   onAbrirSalvosMensagem?: (mensagemId: string) => void
 * }} props
 */
export default function CanalDrawer({
  aberto,
  onFechar,
  canalId,
  canal,
  tituloCanal,
  usuarioId,
  paisTab = 'geral',
  modoFiltroPais = 'mensageiro_aba',
  onAbrirSalvosMensagem,
}) {
  const [entered, setEntered] = useState(false)
  const [aba, setAba] = useState(/** @type {AbaDrawerCanal} */ ('info'))
  const [midias, setMidias] = useState([])
  const [loadingMidia, setLoadingMidia] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [salvos, setSalvos] = useState([])
  const [loadingSalvos, setLoadingSalvos] = useState(false)
  const [denuncias, setDenuncias] = useState([])
  const [loadingDenuncias, setLoadingDenuncias] = useState(false)
  const [modalDenunciaCanal, setModalDenunciaCanal] = useState(false)
  const [portalPronto, setPortalPronto] = useState(false)
  const [visivel, setVisivel] = useState(false)

  const canaisContagem = useMemo(
    () => [canal],
    [canal.id, canal.nome, canal.tipo_publico, canal.categoria, canal.comunidade_prof, canal.empresa_id],
  )
  const membrosPorCanal = useContagemMembrosCanais(canaisContagem)
  const totalMembros = membrosPorCanal[canal.id] ?? 0
  const legendaMembros = canalExibeContagemMembros(canal)
    ? formatarLegendaMembrosCanal(totalMembros)
    : 'Canal da comunidade'

  const ehAdm = isCanalAdmProfissionalGlobal(canal)
  const fotoEmpresa = canal.empresas?.foto_url ?? null
  const IconeCanal = iconeCanalProfissionalLista(canal)

  useEffect(() => {
    setPortalPronto(true)
  }, [])

  useLayoutEffect(() => {
    if (!aberto) {
      setVisivel(false)
      setEntered(false)
      return
    }
    setVisivel(true)
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [aberto])

  useEffect(() => {
    if (!aberto) {
      setAba('info')
      setTermoBusca('')
      setResultadosBusca([])
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [aberto])

  const carregarMidia = useCallback(async () => {
    setLoadingMidia(true)
    try {
      const rows = await listarMidiaCanal(supabase, canalId, { paisTab, limit: 72, modoFiltroPais })
      setMidias(rows)
    } finally {
      setLoadingMidia(false)
    }
  }, [canalId, paisTab, modoFiltroPais])

  const carregarSalvos = useCallback(async () => {
    if (!usuarioId) {
      setSalvos([])
      return
    }
    setLoadingSalvos(true)
    try {
      const { data: linhas, error } = await supabase
        .from('mensagens_canal_salvas')
        .select('mensagem_id, salvo_em')
        .eq('usuario_id', usuarioId)
        .eq('canal_id', canalId)
        .order('salvo_em', { ascending: false })
        .limit(60)

      if (error || !linhas?.length) {
        setSalvos([])
        return
      }

      const ids = linhas.map((r) => String(r.mensagem_id))
      const { data: msgs } = await supabase
        .from('mensagens_canal')
        .select('id, texto, anexo_url, anexo_tipo, created_at, remetente_id')
        .in('id', ids)

      const porId = new Map((msgs ?? []).map((m) => [String(m.id), m]))
      const remetenteIds = (msgs ?? [])
        .map((m) => (m.remetente_id != null ? String(m.remetente_id) : ''))
        .filter(Boolean)
      const remetentesMap = await buscarRemetentesEmLote(supabase, remetenteIds)

      const ordenados = []
      for (const id of ids) {
        const m = porId.get(id)
        if (!m) continue
        const rid = m.remetente_id != null ? String(m.remetente_id) : ''
        ordenados.push({
          id: String(m.id),
          texto: m.texto != null ? String(m.texto) : null,
          anexo_url: m.anexo_url != null ? String(m.anexo_url) : null,
          anexo_tipo: m.anexo_tipo != null ? String(m.anexo_tipo) : null,
          created_at: String(m.created_at ?? ''),
          remetente: remetentesMap.get(rid)?.nome ?? 'Usuário',
        })
      }
      setSalvos(ordenados)
    } finally {
      setLoadingSalvos(false)
    }
  }, [usuarioId, canalId])

  const carregarDenuncias = useCallback(async () => {
    if (!usuarioId) {
      setDenuncias([])
      return
    }
    setLoadingDenuncias(true)
    try {
      const rows = await listarDenunciasCanalDoUsuario(supabase, usuarioId, canalId)
      setDenuncias(rows)
    } finally {
      setLoadingDenuncias(false)
    }
  }, [usuarioId, canalId])

  useEffect(() => {
    if (!aberto) return
    if (aba === 'midia') void carregarMidia()
    if (aba === 'salvos') void carregarSalvos()
    if (aba === 'mais') void carregarDenuncias()
  }, [aberto, aba, carregarMidia, carregarSalvos, carregarDenuncias])

  const executarBusca = useCallback(async () => {
    const t = termoBusca.trim()
    if (t.length < 2) {
      setResultadosBusca([])
      return
    }
    setBuscando(true)
    try {
      const rows = await buscarMensagensCanalPorTexto(supabase, canalId, t, { paisTab, modoFiltroPais })
      const remetenteIds = rows.map((r) => r.remetente_id).filter(Boolean)
      const remetentesMap = await buscarRemetentesEmLote(supabase, remetenteIds)
      setResultadosBusca(
        rows.map((r) => ({
          ...r,
          remetente: r.remetente_id ? remetentesMap.get(r.remetente_id)?.nome ?? 'Usuário' : 'Usuário',
        })),
      )
    } finally {
      setBuscando(false)
    }
  }, [termoBusca, canalId, paisTab, modoFiltroPais])

  useEffect(() => {
    if (aba !== 'buscar') return
    const t = window.setTimeout(() => {
      void executarBusca()
    }, 350)
    return () => clearTimeout(t)
  }, [termoBusca, aba, executarBusca])

  const enviarDenunciaCanal = useCallback(
    async (motivo, descricao) => {
      if (!usuarioId) return { ok: false, error: 'Entre na conta.' }
      return enviarDenunciaMensagemCanal(supabase, {
        denuncianteId: usuarioId,
        canalId,
        canalNome: tituloCanal,
        tipo: 'canal',
        motivo,
        descricao,
      })
    },
    [usuarioId, canalId, tituloCanal],
  )

  const statusLabel = useMemo(
    () => ({
      pendente: 'Aguardando ADM',
      em_investigacao: 'Em investigação',
      resolvida: 'Resolvida',
      arquivada: 'Arquivada',
    }),
    [],
  )

  if (!aberto || !portalPronto || !visivel) return null
  if (typeof document === 'undefined') return null

  const botoesAcao = [
    { id: 'midia', label: 'Mídia', icon: ImageIcon },
    { id: 'buscar', label: 'Buscar', icon: Search },
    { id: 'salvos', label: 'Salvos', icon: Bookmark },
    { id: 'mais', label: '', icon: MoreHorizontal, semTexto: true },
  ]

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[250] max-h-[100dvh] transition-opacity duration-300 ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        role="presentation"
      >
        <button type="button" className="absolute inset-0 bg-black/70" aria-label="Fechar" onClick={onFechar} />
        <aside
          className={`absolute right-0 top-0 flex h-full max-h-[100dvh] w-full flex-col overflow-hidden bg-[#0e0e0e] text-white shadow-2xl transition-transform duration-300 ease-out sm:max-w-md ${
            entered ? 'translate-x-0' : 'translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Informações do canal"
        >
          <div className="flex shrink-0 items-center gap-2 px-3 py-3">
            <button
              type="button"
              onClick={onFechar}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
              aria-label="Voltar ao chat"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden />
            </button>
          </div>

          <div className="scrollbar-perfil flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8">
            <div className="flex flex-col items-center pb-6 pt-2 text-center">
              <div
                className={`mb-4 h-28 w-28 overflow-hidden rounded-xl ${
                  fotoEmpresa ? 'bg-gray-800' : ehAdm ? CLASSE_AVATAR_CANAL_ADMINISTRACAO.replace('h-12 w-12', 'h-28 w-28') : CLASSE_AVATAR_CANAL_PROFISSIONAL.replace('h-12 w-12', 'h-28 w-28')
                }`}
              >
                {fotoEmpresa ? (
                  <div className="relative h-full w-full">
                    <AvatarImage src={fotoEmpresa} alt="" width={112} height={112} className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <IconeCanal className="h-12 w-12 text-white" strokeWidth={1.5} aria-hidden />
                  </div>
                )}
              </div>
              <h1 className="max-w-full truncate text-xl font-semibold text-white">{tituloCanal}</h1>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white/55">
                <Users className="h-4 w-4 shrink-0" aria-hidden />
                {legendaMembros}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-4 gap-2">
              {botoesAcao.map((btn) => {
                const Icon = btn.icon
                const ativo = aba === btn.id
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setAba(/** @type {AbaDrawerCanal} */ (btn.id))}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 transition ${
                      ativo ? 'bg-white/15' : 'bg-white/8 hover:bg-white/12'
                    }`}
                  >
                    <Icon className="h-6 w-6 text-[#5eb4ff]" strokeWidth={1.75} aria-hidden />
                    {btn.semTexto ? null : (
                      <span className="text-[11px] font-medium text-[#5eb4ff]">{btn.label}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {aba === 'buscar' ? (
              <div className="space-y-3">
                <input
                  type="search"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Buscar palavra no canal…"
                  className="w-full rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#0097b2] focus:outline-none"
                  autoFocus
                />
                {termoBusca.trim().length > 0 && termoBusca.trim().length < 2 ? (
                  <p className="text-sm text-white/50">Digite pelo menos 2 caracteres.</p>
                ) : null}
                {buscando ? <p className="text-sm text-white/50">Buscando…</p> : null}
                {!buscando && resultadosBusca.length === 0 && termoBusca.trim().length >= 2 ? (
                  <p className="text-sm text-white/50">Nenhuma mensagem encontrada.</p>
                ) : null}
                <ul className="space-y-2">
                  {resultadosBusca.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onFechar()
                          onAbrirSalvosMensagem?.(m.id)
                        }}
                        className="w-full rounded-xl bg-white/8 px-3 py-2.5 text-left hover:bg-white/12"
                      >
                        <p className="text-[10px] text-white/45">
                          {m.remetente} ·{' '}
                          {new Date(m.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="mt-0.5 line-clamp-3 text-sm text-white/90">{m.texto || '(sem texto)'}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {aba === 'midia' ? (
              <div>
                {loadingMidia ? (
                  <p className="text-sm text-white/50">Carregando mídia…</p>
                ) : midias.length === 0 ? (
                  <p className="text-sm text-white/50">Nenhuma mídia compartilhada ainda.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {midias.map((m) => (
                      <div key={m.id} className="aspect-square overflow-hidden rounded-md bg-white/10">
                        {ehAnexoImagemCanal(m.anexo_url, m.anexo_tipo) ? (
                          <CanalMensagemImagem src={m.anexo_url} className="h-full w-full object-cover" />
                        ) : ehAnexoAudioCanal(m.anexo_url, m.anexo_tipo) ? (
                          <div className="flex h-full items-center justify-center p-2">
                            <CanalMensagemAudio src={m.anexo_url} />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {aba === 'salvos' ? (
              <div>
                {!usuarioId ? (
                  <p className="text-sm text-white/50">Entre na conta para ver mensagens salvas.</p>
                ) : loadingSalvos ? (
                  <p className="text-sm text-white/50">Carregando…</p>
                ) : salvos.length === 0 ? (
                  <p className="text-sm text-white/50">
                    Nenhuma mensagem salva neste canal. Use ⋮ na mensagem → Salvar.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {salvos.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onFechar()
                            onAbrirSalvosMensagem?.(m.id)
                          }}
                          className="w-full rounded-xl bg-white/8 px-3 py-2.5 text-left hover:bg-white/12"
                        >
                          <p className="text-[10px] text-white/45">{m.remetente}</p>
                          {m.texto ? (
                            <p className="mt-0.5 line-clamp-2 text-sm text-white/90">{m.texto}</p>
                          ) : null}
                          {ehAnexoImagemCanal(m.anexo_url, m.anexo_tipo) ? (
                            <div className="relative mt-2 h-20 w-20 overflow-hidden rounded-lg">
                              <Image
                                src={m.anexo_url}
                                alt=""
                                width={80}
                                height={80}
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {aba === 'mais' ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setModalDenunciaCanal(true)}
                  className="flex w-full items-center gap-3 rounded-xl bg-white/8 px-4 py-3 text-left hover:bg-white/12"
                >
                  <Flag className="h-5 w-5 text-[#5eb4ff]" aria-hidden />
                  <span className="text-sm font-medium">Denunciar canal</span>
                </button>

                <div>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
                    Suas denúncias neste canal
                  </h2>
                  {!usuarioId ? (
                    <p className="text-sm text-white/50">Entre na conta.</p>
                  ) : loadingDenuncias ? (
                    <p className="text-sm text-white/50">Carregando…</p>
                  ) : denuncias.length === 0 ? (
                    <p className="text-sm text-white/50">
                      Denúncias de mensagens aparecem aqui até a equipe ADM analisar.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {denuncias.map((d) => (
                        <li key={d.id} className="rounded-xl bg-white/8 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-white/90">
                              {d.tipo === 'canal' ? 'Canal' : 'Mensagem'} · {d.motivo}
                            </p>
                            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
                              {statusLabel[d.status] ?? d.status}
                            </span>
                          </div>
                          {d.descricao ? (
                            <p className="mt-1 text-xs text-white/55 line-clamp-2">{d.descricao}</p>
                          ) : null}
                          <p className="mt-1 text-[10px] text-white/40">
                            {new Date(d.created_at).toLocaleString('pt-BR')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}

            {aba === 'info' ? (
              <p className="text-center text-sm text-white/45">
                Toque em Mídia, Buscar, Salvos ou ⋮ para ver mais opções do canal.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <ModalDenunciaCanal
        aberto={modalDenunciaCanal}
        titulo="Denunciar canal"
        onFechar={() => setModalDenunciaCanal(false)}
        onEnviar={enviarDenunciaCanal}
      />
    </>,
    document.body,
  )
}
