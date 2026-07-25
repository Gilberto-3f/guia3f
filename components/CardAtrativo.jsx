'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import MediaFillImage from '@/components/MediaFillImage'
import { Heart } from 'lucide-react'
import BotaoDinamico from '@/components/BotaoDinamico'
import BotaoRecomendar from '@/components/BotaoRecomendar'
import NomeComVerificacao from '@/components/NomeComVerificacao'
import BotaoEstrelaFavorito from '@/components/favoritos/BotaoEstrelaFavorito'
import BandeiraPais from '@/components/BandeiraPais'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import { supabase } from '@/lib/supabase'
import { usuarioTemFavorito } from '@/lib/favoritosTurista'

/**
 * @param {{
 *   empresa: {
 *     id: string
 *     nome_fantasia: string
 *     foto_url: string | null
 *     nome_usuario?: string | null
 *     descricao_curta: string | null
 *     nota_media: number | null
 *     categoria: string
 *     cidade: string
 *     whatsapp?: string | null
 *     preco_ticket_inteira?: number | null
 *     preco_ticket_meia?: number | null
 *     preco_diaria?: number | null
 *     palavras_chave?: unknown
 *     endereco?: string | null
 *     bairro?: string | null
 *     total_avaliacoes?: number | null
 *     is_seguindo?: boolean
 *     docs_verificado?: boolean | null
 *     status?: string | null
 *     plano?: string | null
 *   },
 *   segmentoGuiaSlug?: string | null
 *   onSeguirToggle?: () => void
 *   temBotaoDinamico?: boolean
 *   emDegustacao?: boolean
 *   planosCarregando?: boolean
 *   degustacaoCarregando?: boolean
 * }} props
 */
export default function CardAtrativo({
  empresa,
  segmentoGuiaSlug = null,
  temBotaoDinamico = true,
  emDegustacao = false,
  planosCarregando = false,
  degustacaoCarregando = false,
}) {
  const router = useRouter()
  const { perfilEhProfissional, recursosProfissionaisLiberados, loading: gateLoading } =
    useProfissionalGate()
  const [usuarioId, setUsuarioId] = useState(/** @type {string | null} */ (null))
  const [favEmpresa, setFavEmpresa] = useState(Boolean(empresa.is_seguindo))
  const [botoesLiberados, setBotoesLiberados] = useState(false)

  useEffect(() => {
    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!ativo) return
      setUsuarioId(uid)
      if (!uid || !empresa.id) return
      const salvo = await usuarioTemFavorito(supabase, uid, empresa.id, 'empresa')
      if (ativo) setFavEmpresa(salvo)
    })()
    return () => {
      ativo = false
    }
  }, [empresa.id])

  const empresaVerificada = contaVerificadaDocumentacao('empresa', empresa)
  const aguardandoBotoes = gateLoading || planosCarregando || degustacaoCarregando
  useEffect(() => {
    if (!aguardandoBotoes) setBotoesLiberados(true)
  }, [aguardandoBotoes])
  const mostrarBotaoDinamico = empresaVerificada && (temBotaoDinamico || emDegustacao)
  const mostrarRecomendar = perfilEhProfissional && recursosProfissionaisLiberados
  const exibirBotoes = botoesLiberados || !aguardandoBotoes

  const desc =
    empresa.descricao_curta && empresa.descricao_curta.length > 170
      ? `${empresa.descricao_curta.substring(0, 170)}...`
      : empresa.descricao_curta || ''

  const username = (empresa?.nome_usuario ?? '').toString().replace(/^@+/, '').trim()

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-lg font-extrabold text-[#0097b2]">
          <BandeiraPais cidade={empresa?.cidade} className="text-lg leading-none" />
          {username ? <span className="truncate">@{username}</span> : <span className="h-5" aria-hidden />}
        </div>
        <BotaoEstrelaFavorito
          usuarioId={usuarioId}
          alvoId={empresa.id}
          tipo="empresa"
          inicial={favEmpresa}
          size={22}
          onChange={setFavEmpresa}
        />
      </div>

      <div className="relative mt-2 aspect-square w-full min-w-0 bg-gray-100">
        {empresa.foto_url ? (
          <MediaFillImage
            src={empresa.foto_url}
            alt={empresa.nome_fantasia}
            sizes="(max-width: 768px) 100vw, 520px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">Sem foto</div>
        )}
      </div>

      <div className="px-4 pb-4 pt-3">
        <h3 className="line-clamp-1 text-base font-extrabold text-[#001f3f]">
          <NomeComVerificacao
            nome={String(empresa.nome_fantasia ?? '')}
            verificado={empresaVerificada}
            verificadoTipo="empresa"
            nomeClassName="line-clamp-1"
          />
        </h3>

        {desc ? <p className="mt-1 text-sm text-gray-600">{desc}</p> : null}

        <div className="mt-4 flex min-h-[3.25rem] min-w-0 gap-2">
          {!exibirBotoes ? (
            <div className="w-full" aria-busy="true" aria-label="A carregar botões" />
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push(`/empresa/${empresa.id}`)}
                className="flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-[#0097b2] px-2 py-2 text-center text-xs font-extrabold leading-tight text-white whitespace-normal hover:opacity-95 sm:text-sm"
              >
                <Heart size={20} className="shrink-0 text-white" aria-hidden />
                <span>VISITAR PÁGINA</span>
              </button>
              {mostrarRecomendar ? (
                <BotaoRecomendar empresa={empresa} segmentoGuiaSlug={segmentoGuiaSlug} />
              ) : mostrarBotaoDinamico ? (
                <BotaoDinamico
                  categoria={empresa.categoria}
                  cidade={empresa.cidade}
                  empresaId={empresa.id}
                  empresaNome={empresa.nome_fantasia}
                  empresaUsername={empresa.nome_usuario ?? null}
                  empresaFotoUrl={empresa.foto_url ?? null}
                  notaMedia={empresa.nota_media != null ? Number(empresa.nota_media) : null}
                  empresaVerificada={empresaVerificada}
                  whatsapp={empresa.whatsapp ?? null}
                  precoTicketInteira={Number(empresa.preco_ticket_inteira) || 0}
                  precoTicketMeia={Number(empresa.preco_ticket_meia) || 0}
                  palavrasChave={empresa.palavras_chave}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
