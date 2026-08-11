'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Briefcase, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { supabase } from '@/lib/supabase'
import { abrirLinkAppParceiro, carregarLinkAppParceiro } from '@/lib/appParceiroLink'
import PopupRecomendarMobilidade from '@/components/PopupRecomendarMobilidade'
import DrawerManifestoEspaco from '@/components/mobilidade/DrawerManifestoEspaco'
import DrawerCalendarioEspaco from '@/components/mobilidade/DrawerCalendarioEspaco'
import DrawerEcossistemaEspaco from '@/components/mobilidade/DrawerEcossistemaEspaco'
import DrawerHistoricoAtendimentosEspaco from '@/components/mobilidade/DrawerHistoricoAtendimentosEspaco'
import DrawerHistoricoParceriasEspaco from '@/components/mobilidade/DrawerHistoricoParceriasEspaco'
import {
  botoesEspacoProfissional,
  resolverPainelMobilidade,
  type EspacoProfissionalAcaoId,
  type PainelMobilidadeModo,
} from '@/lib/mobilidadePainelProfissional'

const COR = '#0097b2'
const NOTA_REFERENCIA = 5
const CACHE_KEY = 'guia_espaco_profissional_cache_v1'

type EspacoCache = {
  nome: string
  username: string | null
  foto: string | null
  verificado: boolean
  notaMedia: number | null
  modo: PainelMobilidadeModo
  placaVermelha: boolean
  categorias: string[]
}

function lerCache(): EspacoCache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as EspacoCache
    if (!o || typeof o !== 'object' || !o.modo) return null
    return o
  } catch {
    return null
  }
}

function gravarCache(c: EspacoCache) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
}

type Props = {
  aberto: boolean
  onFechar: () => void
  forcarModo?: PainelMobilidadeModo | null
}

function formatarNotaExibicao(media: number | null): string {
  const n = media != null && media > 0 ? media : NOTA_REFERENCIA
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function modoDesdeGate(
  forcarModo: PainelMobilidadeModo | null | undefined,
  profRow: unknown,
  cache: EspacoCache | null,
): PainelMobilidadeModo | null {
  if (forcarModo) return forcarModo
  if (cache?.modo) return cache.modo
  const row = profRow as { categorias?: unknown } | null
  const cats = Array.isArray(row?.categorias)
    ? row.categorias.filter((c): c is string => typeof c === 'string')
    : []
  if (cats.length === 0 && !cache) return null
  return resolverPainelMobilidade(Boolean(cache?.placaVermelha), cats.length ? cats : cache?.categorias)
}

/**
 * Drawer ESPAÇO PROFISSIONAL — perfil + botões por categoria.
 * Abre na hora (cache/gate); completa dados em background.
 */
export default function DrawerEspacoProfissionalMobilidade({
  aberto,
  onFechar,
  forcarModo = null,
}: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)
  const { fotoPerfilBarra, profRow } = useProfissionalGate()

  const cacheInicial = typeof window !== 'undefined' ? lerCache() : null
  const [nome, setNome] = useState(() => cacheInicial?.nome ?? '')
  const [username, setUsername] = useState<string | null>(() => cacheInicial?.username ?? null)
  const [foto, setFoto] = useState<string | null>(
    () => cacheInicial?.foto ?? fotoPerfilBarra ?? null,
  )
  const [verificado, setVerificado] = useState(() => cacheInicial?.verificado ?? false)
  const [notaMedia, setNotaMedia] = useState<number | null>(() => cacheInicial?.notaMedia ?? null)
  const [modo, setModo] = useState<PainelMobilidadeModo | null>(() =>
    modoDesdeGate(forcarModo, null, cacheInicial),
  )
  const [acaoBusy, setAcaoBusy] = useState(false)
  const [acaoErro, setAcaoErro] = useState('')
  const [recomendarMobAberto, setRecomendarMobAberto] = useState(false)
  const [manifestoAberto, setManifestoAberto] = useState(false)
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  const [ecossistemaAberto, setEcossistemaAberto] = useState(false)
  const [historicoAtendAberto, setHistoricoAtendAberto] = useState(false)
  const [historicoParcAberto, setHistoricoParcAberto] = useState(false)
  const [historicoParcAba, setHistoricoParcAba] = useState<'andamento' | 'historico'>('andamento')
  const [cidadesAtuacao, setCidadesAtuacao] = useState<unknown>(null)

  const handleAcao = useCallback(
    async (id: EspacoProfissionalAcaoId) => {
      setAcaoErro('')
      if (id === 'app_parceiro') {
        setAcaoBusy(true)
        try {
          const link = await carregarLinkAppParceiro({
            cidadesAtuacao,
          })
          if (!abrirLinkAppParceiro(link)) {
            setAcaoErro(t('appParceiroLinkAusente'))
          }
        } catch {
          setAcaoErro(t('appParceiroLinkAusente'))
        } finally {
          setAcaoBusy(false)
        }
        return
      }
      if (id === 'mobilidade_urbana') {
        setRecomendarMobAberto(true)
        return
      }
      if (id === 'manifesto') {
        setManifestoAberto(true)
        return
      }
      if (id === 'calendario') {
        setCalendarioAberto(true)
        return
      }
      if (id === 'ecossistema') {
        setEcossistemaAberto(true)
        return
      }
      if (id === 'historico') {
        setHistoricoAtendAberto(true)
        return
      }
      if (id === 'parcerias') {
        setHistoricoParcAberto(true)
        return
      }
    },
    [t, cidadesAtuacao],
  )

  useEffect(() => {
    if (!aberto) return
    setAcaoErro('')
    const m = modoDesdeGate(forcarModo, profRow, lerCache())
    if (m) setModo(m)
    if (fotoPerfilBarra && !foto) setFoto(fotoPerfilBarra)
  }, [aberto, forcarModo, profRow, fotoPerfilBarra, foto])

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid || !ativo) return

      const { data: prof } = await supabase
        .from('profissionais')
        .select(
          'id, nome_completo, nome_usuario, foto_perfil_url, foto_url, docs_verificado, status, placa_vermelha, categorias, cidade_atuacao',
        )
        .eq('usuario_id', uid)
        .maybeSingle()
      if (!ativo || !prof) return

      setCidadesAtuacao(prof.cidade_atuacao ?? null)

      const nomeNovo = String(prof.nome_completo ?? t('espacoProfissionalFallbackNome'))
      const usernameNovo = prof.nome_usuario != null ? String(prof.nome_usuario) : null
      const f =
        prof.foto_perfil_url != null && String(prof.foto_perfil_url).trim()
          ? String(prof.foto_perfil_url)
          : prof.foto_url != null && String(prof.foto_url).trim()
            ? String(prof.foto_url)
            : null
      const fotoNova = f ?? fotoPerfilBarra
      const verificadoNovo =
        Boolean(prof.docs_verificado) || String(prof.status ?? '').toLowerCase() === 'aprovado'
      const cats = Array.isArray(prof.categorias)
        ? prof.categorias.filter((c): c is string => typeof c === 'string')
        : []
      const placa = Boolean(prof.placa_vermelha)
      const modoNovo = forcarModo ?? resolverPainelMobilidade(placa, cats)

      setNome(nomeNovo)
      setUsername(usernameNovo)
      setFoto(fotoNova)
      setVerificado(verificadoNovo)
      setModo(modoNovo)

      const profId = String(prof.id ?? '')
      const alvoIds = [...new Set([uid, ...(profId ? [profId] : [])])]
      const { data: avs } = await supabase
        .from('avaliacoes')
        .select('nota')
        .eq('alvo_tipo', 'profissional')
        .in('alvo_id', alvoIds)
      if (!ativo) return
      const notas = (avs ?? [])
        .map((r) => Number(r.nota))
        .filter((n) => Number.isFinite(n))
      const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null
      setNotaMedia(media)

      gravarCache({
        nome: nomeNovo,
        username: usernameNovo,
        foto: fotoNova,
        verificado: verificadoNovo,
        notaMedia: media,
        modo: modoNovo,
        placaVermelha: placa,
        categorias: cats,
      })
    })()
    return () => {
      ativo = false
    }
  }, [aberto, fotoPerfilBarra, forcarModo, t])

  if (!aberto) return null

  const handle = String(username ?? '')
    .replace(/^@+/, '')
    .trim()
  const modoEfetivo = forcarModo ?? modo
  const acoes: EspacoProfissionalAcaoId[] =
    modoEfetivo != null ? botoesEspacoProfissional(modoEfetivo) : []
  const notaTexto = formatarNotaExibicao(notaMedia)

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[90] flex flex-col bg-white"
        style={{ height: 'var(--app-height, 100dvh)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-espaco-profissional-titulo"
      >
        <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
          <div className="flex h-12 items-center gap-2 px-3">
            <Briefcase className="h-5 w-5 shrink-0 text-white" aria-hidden />
            <h2
              id="drawer-espaco-profissional-titulo"
              className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
            >
              {t('espacoProfissionalTitulo')}
            </h2>
            <button
              type="button"
              onClick={onFechar}
              className="rounded-lg p-2 text-white/90 hover:bg-white/15"
              aria-label={t('fechar')}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6" data-modal-scroll-lock-scrollable>
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100"
              style={{ boxShadow: `0 0 0 4px ${COR}` }}
            >
              {foto ? (
                <AvatarImage src={foto} alt="" fill className="object-cover" sizes="80px" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#0097b2]">
                  {(nome || 'P').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-0.5 leading-tight">
              <p className="text-base font-bold leading-tight text-gray-900">
                {nome || t('espacoProfissionalFallbackNome')}
              </p>
              {handle ? (
                <UsuarioHandleVerificado
                  username={handle}
                  verificado={verificado}
                  verificadoTipo="profissional"
                  notaMedia={notaMedia}
                  asButton={false}
                  className="justify-center text-sm font-normal leading-tight text-gray-600"
                />
              ) : (
                <span
                  className="inline-flex items-center gap-0.5 text-sm font-bold text-amber-500"
                  aria-label={`Nota ${notaTexto}`}
                >
                  <span aria-hidden>★</span>
                  {notaTexto}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {modoEfetivo == null ? (
              <p className="animate-pulse text-center text-sm text-gray-400">…</p>
            ) : (
              acoes.map((id) => {
                const subtitulo = t(`espacoAcao.${id}.subtitulo`).trim()
                const busyApp = id === 'app_parceiro' && acaoBusy
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={busyApp}
                    className="flex w-full flex-col items-center justify-center gap-0 rounded-2xl px-4 py-4 text-center text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-60"
                    style={{ backgroundColor: COR }}
                    onClick={() => void handleAcao(id)}
                  >
                    <span className="text-base font-extrabold uppercase leading-none tracking-wide">
                      {busyApp ? t('appParceiroAbrindo') : t(`espacoAcao.${id}.titulo`)}
                    </span>
                    {!busyApp && subtitulo ? (
                      <span className="mt-0.5 text-sm font-normal leading-none text-white/90">
                        {subtitulo}
                      </span>
                    ) : null}
                  </button>
                )
              })
            )}
            {acaoErro ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800">
                {acaoErro}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <PopupRecomendarMobilidade
        aberto={recomendarMobAberto}
        onFechar={() => setRecomendarMobAberto(false)}
      />
      <DrawerManifestoEspaco aberto={manifestoAberto} onFechar={() => setManifestoAberto(false)} />
      <DrawerCalendarioEspaco
        aberto={calendarioAberto}
        onFechar={() => setCalendarioAberto(false)}
      />
      <DrawerEcossistemaEspaco
        aberto={ecossistemaAberto}
        onFechar={() => setEcossistemaAberto(false)}
        onSolicitadoSucesso={() => {
          setEcossistemaAberto(false)
          setHistoricoParcAba('andamento')
          setHistoricoParcAberto(true)
        }}
      />
      <DrawerHistoricoAtendimentosEspaco
        aberto={historicoAtendAberto}
        onFechar={() => setHistoricoAtendAberto(false)}
      />
      <DrawerHistoricoParceriasEspaco
        key={`hist-parc-${historicoParcAba}-${historicoParcAberto ? '1' : '0'}`}
        aberto={historicoParcAberto}
        onFechar={() => setHistoricoParcAberto(false)}
        abaInicial={historicoParcAba}
      />
    </>,
    document.body,
  )
}
