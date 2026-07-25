'use client'

import { useState } from 'react'
import { ShoppingBag, Ticket, Utensils, Wrench } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import DrawerCardapio from '@/components/DrawerCardapio'
import DrawerServicosLocais from '@/components/DrawerServicosLocais'
import DrawerTicketsAtrativos from '@/components/DrawerTicketsAtrativos'
import ModalVisualizacao from '@/components/atividades/ModalVisualizacao'

/**
 * @typedef {{ id?: string, foto_url?: string | null, nome?: string }} ProdutoSnapAtividade
 */

/**
 * Engajamento em post de catálogo (curtida / comentário / repost).
 * @param {{
 *   variante: 'curtiu' | 'comentou' | 'repostou' | 'curtiu_repost'
 *   kind?: 'produtos' | 'cardapio' | 'servicos' | 'atrativos'
 *   interactorUsername: string
 *   interactorFoto: string | null
 *   donorUsername: string
 *   hrefInteractor: string
 *   hrefDonor: string
 *   postId: string
 *   produtos: ProdutoSnapAtividade[]
 *   empresaId?: string | null
 *   empresaNome?: string | null
 *   empresaFotoUrl?: string | null
 *   textoComentario?: string | null
 *   tempoInteracao?: string
 *   modoMinhaConta?: boolean
 *   mostrarBotaoCatalogo?: boolean
 *   interactorVerificado?: boolean
 *   interactorVerificadoTipo?: 'profissional' | 'empresa'
 *   donorVerificado?: boolean
 *   donorVerificadoTipo?: 'profissional' | 'empresa'
 * }} props
 */
export default function AtividadeCatalogo({
  variante,
  kind = 'produtos',
  interactorUsername,
  interactorFoto,
  donorUsername,
  hrefInteractor,
  hrefDonor,
  postId,
  produtos = [],
  empresaId = null,
  empresaNome = null,
  empresaFotoUrl = null,
  textoComentario = null,
  tempoInteracao = '',
  modoMinhaConta = false,
  mostrarBotaoCatalogo = false,
  interactorVerificado = false,
  interactorVerificadoTipo = 'profissional',
  donorVerificado = false,
  donorVerificadoTipo = 'empresa',
}) {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const [drawerAberto, setDrawerAberto] = useState(false)

  const snaps = (Array.isArray(produtos) ? produtos : []).slice(0, 3)
  const fotos = snaps
    .map((p) => (p?.foto_url != null && String(p.foto_url).trim() !== '' ? String(p.foto_url) : ''))
    .filter(Boolean)

  const ehCardapio = kind === 'cardapio'
  const ehServicos = kind === 'servicos'
  const ehAtrativos = kind === 'atrativos'
  const rotuloCatalogo = ehAtrativos
    ? 'tickets'
    : ehServicos
      ? 'serviços'
      : ehCardapio
        ? 'cardápio'
        : 'catálogo'
  const rotuloItens = ehAtrativos
    ? 'os novos atrativos'
    : ehServicos
      ? 'os novos serviços'
      : ehCardapio
        ? 'os novos pratos'
        : 'os novos produtos'
  const IconeCatalogo = ehAtrativos
    ? Ticket
    : ehServicos
      ? Wrench
      : ehCardapio
        ? Utensils
        : ShoppingBag

  /** Comentário no catálogo (Minha Conta): só o texto, sem carrossel de produtos/pratos. */
  const ocultarCarrosselProdutos = variante === 'comentou'

  let frase = null
  if (modoMinhaConta) {
    if (variante === 'curtiu_repost') frase = `curtiu um ${rotuloCatalogo} que você repostou.`
    else if (variante === 'curtiu') frase = `curtiu seu ${rotuloCatalogo}.`
    else if (variante === 'comentou') frase = `comentou no seu ${rotuloCatalogo}.`
    else if (variante === 'repostou') frase = `repostou seu ${rotuloCatalogo}.`
  } else if (variante === 'curtiu') {
    frase = (
      <>
        curtiu {rotuloItens} de{' '}
        <UsuarioHandleVerificado
          username={donorUsername}
          verificado={donorVerificado}
          verificadoTipo={donorVerificadoTipo}
          onClick={() => router.push(hrefDonor)}
        />
      </>
    )
  } else if (variante === 'comentou') {
    frase = (
      <>
        comentou no {rotuloCatalogo} de{' '}
        <UsuarioHandleVerificado
          username={donorUsername}
          verificado={donorVerificado}
          verificadoTipo={donorVerificadoTipo}
          onClick={() => router.push(hrefDonor)}
        />
      </>
    )
  } else if (variante === 'curtiu_repost') {
    frase = (
      <>
        curtiu um {rotuloCatalogo} repostado por{' '}
        <UsuarioHandleVerificado
          username={donorUsername}
          verificado={donorVerificado}
          verificadoTipo={donorVerificadoTipo}
          onClick={() => router.push(hrefDonor)}
        />
      </>
    )
  } else if (variante === 'repostou') {
    frase = (
      <>
        repostou o {rotuloCatalogo} de{' '}
        <UsuarioHandleVerificado
          username={donorUsername}
          verificado={donorVerificado}
          verificadoTipo={donorVerificadoTipo}
          onClick={() => router.push(hrefDonor)}
        />
      </>
    )
  }

  const resumoModal = modoMinhaConta
    ? variante === 'comentou'
      ? `comentou no seu ${rotuloCatalogo}`
      : variante === 'repostou'
        ? `repostou seu ${rotuloCatalogo}`
        : variante === 'curtiu_repost'
          ? `curtiu um ${rotuloCatalogo} que você repostou`
          : `curtiu seu ${rotuloCatalogo}`
    : variante === 'comentou'
      ? `comentou no ${rotuloCatalogo} de @${donorUsername}`
      : variante === 'curtiu_repost'
        ? `curtiu um ${rotuloCatalogo} repostado por @${donorUsername}`
        : variante === 'repostou'
          ? `repostou o ${rotuloCatalogo} de @${donorUsername}`
          : `curtiu ${rotuloItens} de @${donorUsername}`

  const mostrarSnaps = !ocultarCarrosselProdutos && snaps.length > 0
  /** Botão verde do catálogo da empresa: não nas curtidas — clique abre o post do feed. */
  const mostrarBotao =
    !ocultarCarrosselProdutos &&
    mostrarBotaoCatalogo &&
    Boolean(empresaId) &&
    variante !== 'curtiu' &&
    variante !== 'curtiu_repost'

  return (
    <>
      <div className="min-w-0">
        <div className="grid min-w-0 grid-cols-[2.5rem_1fr] items-start gap-x-2">
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => router.push(hrefInteractor)}
              className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
            >
              <AvatarImage src={interactorFoto} alt="" fill className="object-cover" sizes="40px" />
            </button>
            {tempoInteracao ? (
              <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">
                {tempoInteracao}
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-snug text-gray-800">
              <UsuarioHandleVerificado
                username={interactorUsername}
                verificado={interactorVerificado}
                verificadoTipo={interactorVerificadoTipo}
                onClick={() => router.push(hrefInteractor)}
              />{' '}
              {frase}
            </p>

            {variante === 'comentou' && textoComentario ? (
              <button
                type="button"
                onClick={() => setModal(true)}
                className="mt-1.5 block min-h-0 w-full text-left"
              >
                <p className="line-clamp-3 text-sm italic text-gray-600">
                  &ldquo;{String(textoComentario || '').trimEnd()}&rdquo;
                </p>
              </button>
            ) : null}

            {mostrarSnaps || mostrarBotao ? (
              <div className="mt-2 flex items-center gap-2">
                {mostrarSnaps ? (
                  <button
                    type="button"
                    onClick={() => setModal(true)}
                    className={`flex min-w-0 items-center gap-1.5 overflow-x-auto ${mostrarBotao ? 'flex-1' : 'w-full'}`}
                    aria-label="Ver catálogo no feed"
                  >
                    {snaps.map((p, i) => {
                      const foto =
                        p?.foto_url != null && String(p.foto_url).trim() !== ''
                          ? String(p.foto_url)
                          : null
                      const key = p?.id != null ? String(p.id) : `p-${i}`
                      return (
                        <span
                          key={key}
                          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-200"
                        >
                          {foto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={foto} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                      )
                    })}
                  </button>
                ) : null}

                {mostrarBotao ? (
                  <button
                    type="button"
                    onClick={() => setDrawerAberto(true)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#00D443] text-white shadow-sm"
                    aria-label={`Abrir ${rotuloCatalogo}`}
                  >
                    <IconeCatalogo className="h-5 w-5" aria-hidden />
                  </button>
                ) : null}
              </div>
            ) : !ocultarCarrosselProdutos && fotos.length === 0 && variante !== 'comentou' ? (
              <button
                type="button"
                onClick={() => setModal(true)}
                className="mt-1.5 text-xs font-semibold text-[#0097b2]"
              >
                Ver publicação
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ModalVisualizacao
        aberto={modal}
        onFechar={() => setModal(false)}
        postIds={[postId]}
        interacaoUsuario={interactorUsername}
        interacaoResumo={resumoModal}
      />

      {empresaId ? (
        ehAtrativos ? (
          <DrawerTicketsAtrativos
            isOpen={drawerAberto}
            onClose={() => setDrawerAberto(false)}
            empresaId={empresaId}
            empresaNome={empresaNome || donorUsername || 'Empresa'}
            empresaUsername={donorUsername}
            empresaFotoUrl={empresaFotoUrl}
          />
        ) : ehServicos ? (
          <DrawerServicosLocais
            isOpen={drawerAberto}
            onClose={() => setDrawerAberto(false)}
            empresaId={empresaId}
            empresaNome={empresaNome || donorUsername || 'Empresa'}
            empresaUsername={donorUsername}
            empresaFotoUrl={empresaFotoUrl}
          />
        ) : ehCardapio ? (
          <DrawerCardapio
            isOpen={drawerAberto}
            onClose={() => setDrawerAberto(false)}
            empresaId={empresaId}
            empresaNome={empresaNome || donorUsername || 'Empresa'}
            empresaUsername={donorUsername}
            empresaFotoUrl={empresaFotoUrl}
          />
        ) : (
          <DrawerProdutosCde
            isOpen={drawerAberto}
            onClose={() => setDrawerAberto(false)}
            empresaId={empresaId}
            empresaNome={empresaNome || donorUsername || 'Empresa'}
            empresaUsername={donorUsername}
            empresaFotoUrl={empresaFotoUrl}
          />
        )
      ) : null}
    </>
  )
}
