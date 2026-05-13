'use client'

import { useEffect, useState } from 'react'
import { AtSign, CheckCircle, Images, Link2, Search, Type, X } from 'lucide-react'
import StoryCanvas from '@/components/StoryCanvas'
import AvatarImage from '@/components/AvatarImage'
import { supabase } from '@/lib/supabase'

/**
 * @typedef {{ usuario_id: string, username: string, nome: string, foto_url: string | null, tipo: string, empresa_id?: string | null }} PerfilMarcacao
 */

/**
 * @param {{
 *   mediaSrc: string
 *   mediaKind: 'image' | 'video'
 *   legenda: string
 *   onLegendaChange: (s: string) => void
 *   posicao: { x: number, y: number }
 *   onPosicaoChange: (p: { x: number, y: number }) => void
 *   posicaoLink: { x: number, y: number }
 *   onPosicaoLinkChange: (p: { x: number, y: number }) => void
 *   fundo: { scale: number, pan_x_pct: number, pan_y_pct: number }
 *   onFundoChange: (f: { scale: number, pan_x_pct: number, pan_y_pct: number }) => void
 *   textoScale: number
 *   onTextoScaleChange: (s: number) => void
 *   linkUrl: string
 *   onLinkChange: (s: string) => void
 *   marcacoes?: { usuario_id: string, username: string, tipo: string, nome?: string, foto_url?: string | null, empresa_id?: string | null, posicao_x?: number, posicao_y?: number }[]
 *   onMarcacoesChange?: (m: { usuario_id: string, username: string, tipo: string, nome?: string, foto_url?: string | null, empresa_id?: string | null, posicao_x?: number, posicao_y?: number }[]) => void
 *   onTrocarFoto: () => void
 *   onPublicar: () => void
 *   publicando?: boolean
 * }} props
 */
export default function EditorStory({
  mediaSrc,
  mediaKind,
  legenda,
  onLegendaChange,
  posicao,
  onPosicaoChange,
  posicaoLink,
  onPosicaoLinkChange,
  fundo,
  onFundoChange,
  textoScale,
  onTextoScaleChange,
  linkUrl,
  onLinkChange,
  marcacoes = [],
  onMarcacoesChange,
  onTrocarFoto,
  onPublicar,
  publicando = false,
}) {
  const [painel, setPainel] = useState(/** @type {null | 'legenda' | 'link' | 'marcar'} */ (null))
  const [termoMarcacao, setTermoMarcacao] = useState('')
  const [buscandoMarcacao, setBuscandoMarcacao] = useState(false)
  const [resultadosMarcacao, setResultadosMarcacao] = useState(/** @type {PerfilMarcacao[]} */ ([]))
  const [meuUsuarioId, setMeuUsuarioId] = useState(/** @type {string | null} */ (null))
  const [toastMarcacao, setToastMarcacao] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    let cancel = false
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancel) setMeuUsuarioId(data.session?.user?.id ?? null)
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!toastMarcacao) return undefined
    const t = window.setTimeout(() => setToastMarcacao(null), 2800)
    return () => window.clearTimeout(t)
  }, [toastMarcacao])

  useEffect(() => {
    if (painel !== 'marcar') return
    const termo = termoMarcacao.trim().replace(/^@+/, '').replace(/[%_,()]/g, '')
    if (termo.length < 2) {
      setResultadosMarcacao([])
      setBuscandoMarcacao(false)
      return
    }
    let cancel = false
    const t = window.setTimeout(() => {
      void (async () => {
        setBuscandoMarcacao(true)
        const pattern = `%${termo}%`
        const cols = 'usuario_id, empresa_id, username, nome, foto_url, tipo'
        const [porUsername, porNome] = await Promise.all([
          supabase.from('perfis_para_busca').select(cols).ilike('username', pattern).limit(12),
          supabase.from('perfis_para_busca').select(cols).ilike('nome', pattern).limit(12),
        ])
        if (cancel) return
        const err = porUsername.error || porNome.error
        if (err) {
          console.error('[EditorStory] buscar marcações:', err)
          setResultadosMarcacao([])
          setBuscandoMarcacao(false)
          return
        }
        /** @type {Map<string, PerfilMarcacao>} */
        const map = new Map()
        for (const row of [...(porUsername.data ?? []), ...(porNome.data ?? [])]) {
          const usuarioId = row.usuario_id != null ? String(row.usuario_id) : ''
          if (!usuarioId || map.has(usuarioId)) continue
          map.set(usuarioId, {
            usuario_id: usuarioId,
            username: row.username != null ? String(row.username).replace(/^@+/, '') : 'usuario',
            nome: row.nome != null ? String(row.nome) : 'Usuário',
            foto_url: row.foto_url != null ? String(row.foto_url) : null,
            tipo: row.tipo != null ? String(row.tipo) : 'turista',
            empresa_id: row.empresa_id != null ? String(row.empresa_id) : null,
          })
        }
        setResultadosMarcacao(
          [...map.values()]
            .filter((p) => !meuUsuarioId || p.usuario_id !== meuUsuarioId)
            .slice(0, 12)
        )
        setBuscandoMarcacao(false)
      })()
    }, 250)
    return () => {
      cancel = true
      window.clearTimeout(t)
    }
  }, [painel, termoMarcacao, meuUsuarioId])

  /** @param {PerfilMarcacao} perfil */
  const adicionarMarcacao = (perfil) => {
    if (!onMarcacoesChange) return
    if (meuUsuarioId && perfil.usuario_id === meuUsuarioId) {
      setToastMarcacao('Você não pode marcar a si mesmo')
      return
    }
    if (marcacoes.some((m) => m.usuario_id === perfil.usuario_id)) return
    const offset = marcacoes.length % 5
    onMarcacoesChange([
      ...marcacoes,
      {
        usuario_id: perfil.usuario_id,
        username: perfil.username,
        tipo: perfil.tipo,
        nome: perfil.nome,
        foto_url: perfil.foto_url,
        empresa_id: perfil.empresa_id ?? null,
        posicao_x: Math.min(82, 50 + offset * 5),
        posicao_y: Math.min(82, 58 + offset * 6),
      },
    ])
    setTermoMarcacao('')
    setResultadosMarcacao([])
  }

  /** @param {string} usuarioId */
  const removerMarcacao = (usuarioId) => {
    onMarcacoesChange?.(marcacoes.filter((m) => m.usuario_id !== usuarioId))
  }

  const moverMarcacao = (usuarioId, p) => {
    onMarcacoesChange?.(
      marcacoes.map((m) => (m.usuario_id === usuarioId ? { ...m, posicao_x: p.x, posicao_y: p.y } : m))
    )
  }

  if (mediaKind !== 'image') {
    return <p className="text-center text-sm text-gray-500">Apenas imagem neste fluxo.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center px-0 pb-0 pt-0">
        <StoryCanvas
          layout="editorFill"
          imageObjectFit="contain"
          mediaSrc={mediaSrc}
          legenda={legenda.trim()}
          posicaoLegenda={posicao}
          linkUrl={linkUrl.trim()}
          posicaoLink={posicaoLink}
          marcacoes={marcacoes}
          fundo={fundo}
          textoScale={textoScale}
          onTextoScaleChange={onTextoScaleChange}
          allowEditImage
          allowEditText
          allowEditLink={Boolean(linkUrl.trim())}
          allowEditMarcacoes
          ocultarPlaceholderLegenda={painel !== 'legenda'}
          onLegendaPos={onPosicaoChange}
          onLinkPos={onPosicaoLinkChange}
          onMarcacaoPos={moverMarcacao}
          onFundoChange={onFundoChange}
          onEditarLegenda={() => setPainel('legenda')}
          onEditarLink={() => setPainel('link')}
        />
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-black/70 px-1 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:gap-1">
          <button
            type="button"
            disabled={publicando}
            onClick={() => setPainel('legenda')}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[#0097b2] transition hover:bg-white/10 disabled:opacity-45 sm:py-2"
          >
            <Type size={22} strokeWidth={2} aria-hidden className="sm:h-[26px] sm:w-[26px]" />
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-xs">Legenda</span>
          </button>
          <button
            type="button"
            disabled={publicando}
            onClick={() => setPainel('link')}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[#0097b2] transition hover:bg-white/10 disabled:opacity-45 sm:py-2"
          >
            <Link2 size={22} strokeWidth={2} aria-hidden className="sm:h-[26px] sm:w-[26px]" />
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-xs">Link</span>
          </button>
          <button
            type="button"
            disabled={publicando}
            onClick={onTrocarFoto}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[#0097b2] transition hover:bg-white/10 disabled:opacity-45 sm:py-2"
          >
            <Images size={22} strokeWidth={2} aria-hidden className="sm:h-[26px] sm:w-[26px]" />
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-xs">Trocar foto</span>
          </button>
          <button
            type="button"
            disabled={publicando}
            onClick={() => setPainel('marcar')}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[#0097b2] transition hover:bg-white/10 disabled:opacity-45 sm:py-2"
          >
            <AtSign size={22} strokeWidth={2} aria-hidden className="sm:h-[26px] sm:w-[26px]" />
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-xs">Marcar</span>
          </button>
          <button
            type="button"
            disabled={publicando}
            onClick={() => void onPublicar()}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-green-500 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45 sm:py-2"
          >
            <CheckCircle size={22} strokeWidth={2} aria-hidden className="sm:h-[26px] sm:w-[26px]" />
            <span className="max-w-full truncate px-0.5 text-[10px] font-semibold sm:text-xs">
              {publicando ? 'Enviando…' : 'Publicar'}
            </span>
          </button>
        </div>
      </footer>

      {painel === 'legenda' ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50"
          aria-label="Fechar legenda"
          onClick={() => setPainel(null)}
        />
      ) : null}
      {painel === 'legenda' ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl sm:border-gray-200 sm:bg-white">
          <label className="mb-2 block text-xs font-medium text-white/80 sm:text-gray-600">Legenda (máx. 150)</label>
          <textarea
            value={legenda}
            maxLength={150}
            onChange={(e) => onLegendaChange(e.target.value)}
            rows={3}
            className="mb-3 w-full rounded-xl border border-white/20 bg-black/40 p-3 text-sm text-white placeholder:text-white/40 sm:border-gray-200 sm:bg-white sm:text-gray-900"
            placeholder="Escreva algo…"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setPainel(null)}
            className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      ) : null}

      {painel === 'link' ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50"
          aria-label="Fechar link"
          onClick={() => setPainel(null)}
        />
      ) : null}
      {painel === 'link' ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl sm:border-gray-200 sm:bg-white">
          <label className="mb-2 block text-xs font-medium text-white/80 sm:text-gray-600">Link opcional</label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder="https://"
            className="mb-3 w-full rounded-xl border border-white/20 bg-black/40 p-3 text-sm text-white placeholder:text-white/40 sm:border-gray-200 sm:bg-white sm:text-gray-900"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setPainel(null)}
            className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      ) : null}

      {painel === 'marcar' ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50"
          aria-label="Fechar marcação"
          onClick={() => setPainel(null)}
        />
      ) : null}
      {painel === 'marcar' ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[75dvh] overflow-hidden rounded-t-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl sm:border-gray-200 sm:bg-white">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white sm:text-gray-900">Marcar @</h2>
            <button
              type="button"
              onClick={() => setPainel(null)}
              className="rounded-full p-1 text-white/80 hover:bg-white/10 sm:text-gray-500 sm:hover:bg-gray-100"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
          <label className="mb-2 block text-xs font-medium text-white/80 sm:text-gray-600">Buscar usuário, profissional ou empresa</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 sm:text-gray-400" aria-hidden />
            <input
              type="search"
              value={termoMarcacao}
              onChange={(e) => setTermoMarcacao(e.target.value)}
              placeholder="@username"
              className="mb-3 w-full rounded-xl border border-white/20 bg-black/40 py-3 pl-9 pr-3 text-sm text-white placeholder:text-white/40 sm:border-gray-200 sm:bg-white sm:text-gray-900"
              autoFocus
            />
          </div>
          {toastMarcacao ? (
            <p className="mb-3 rounded-lg bg-white/10 px-3 py-2 text-center text-xs font-semibold text-white sm:bg-red-50 sm:text-red-700" role="status">
              {toastMarcacao}
            </p>
          ) : null}

          {marcacoes.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {marcacoes.map((m) => (
                <button
                  key={m.usuario_id}
                  type="button"
                  onClick={() => removerMarcacao(m.usuario_id)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#0097b2]/15 px-2 py-1 text-xs font-semibold text-[#0097b2]"
                >
                  @{String(m.username || 'usuario').replace(/^@+/, '')}
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ))}
            </div>
          ) : null}

          <div className="max-h-[42dvh] overflow-y-auto">
            {buscandoMarcacao ? <p className="py-4 text-center text-sm text-white/60 sm:text-gray-500">Buscando…</p> : null}
            {!buscandoMarcacao && termoMarcacao.trim().replace(/^@+/, '').length >= 2 && resultadosMarcacao.length === 0 ? (
              <p className="py-4 text-center text-sm text-white/60 sm:text-gray-500">Nenhum perfil encontrado.</p>
            ) : null}
            <ul className="divide-y divide-white/10 sm:divide-gray-100">
              {resultadosMarcacao.map((p) => {
                const marcado = marcacoes.some((m) => m.usuario_id === p.usuario_id)
                const souEu = Boolean(meuUsuarioId && p.usuario_id === meuUsuarioId)
                return (
                  <li key={p.usuario_id} className="py-1">
                    <button
                      type="button"
                      disabled={marcado}
                      onClick={() => adicionarMarcacao(p)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/10 disabled:opacity-50 sm:hover:bg-gray-50"
                    >
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/10 sm:bg-gray-100">
                        <AvatarImage src={p.foto_url} alt="" fill className="object-cover" sizes="40px" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white sm:text-gray-900">{p.nome}</span>
                        <span className="block truncate text-xs text-white/60 sm:text-gray-500">@{p.username}</span>
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-white/70 sm:bg-gray-100 sm:text-gray-500">
                        {marcado ? 'Marcado' : souEu ? 'Você' : p.tipo}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setPainel(null)}
            className="mt-3 w-full rounded-xl bg-[#0097b2] py-3 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      ) : null}
    </div>
  )
}
