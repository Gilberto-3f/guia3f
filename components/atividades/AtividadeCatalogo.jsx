'use client'

import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import ModalVisualizacao from '@/components/atividades/ModalVisualizacao'

/**
 * @typedef {{ id?: string, foto_url?: string | null, nome?: string }} ProdutoSnapAtividade
 */

/**
 * Engajamento em post de catálogo (curtida / comentário / repost).
 * @param {{
 *   variante: 'curtiu' | 'comentou' | 'repostou' | 'curtiu_repost'
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

  /** Comentário no catálogo (Minha Conta): só o texto, sem carrossel de produtos. */
  const ocultarCarrosselProdutos = variante === 'comentou'

  let frase = null
  if (modoMinhaConta) {
    if (variante === 'curtiu_repost') frase = 'curtiu um catálogo que você repostou.'
    else if (variante === 'curtiu') frase = 'curtiu seu catálogo.'
    else if (variante === 'comentou') frase = 'comentou no seu catálogo.'
    else if (variante === 'repostou') frase = 'repostou seu catálogo.'
  } else if (variante === 'curtiu') {
    frase = (
      <>
        curtiu os novos produtos de{' '}
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
        comentou no catálogo de{' '}
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
        curtiu um catálogo repostado por{' '}
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
        repostou o catálogo de{' '}
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
      ? 'comentou no seu catálogo'
      : variante === 'repostou'
        ? 'repostou seu catálogo'
        : variante === 'curtiu_repost'
          ? 'curtiu um catálogo que você repostou'
          : 'curtiu seu catálogo'
    : variante === 'comentou'
      ? `comentou no catálogo de @${donorUsername}`
      : variante === 'curtiu_repost'
        ? `curtiu um catálogo repostado por @${donorUsername}`
        : variante === 'repostou'
          ? `repostou o catálogo de @${donorUsername}`
          : `curtiu os novos produtos de @${donorUsername}`

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
                    aria-label="Abrir catálogo"
                  >
                    <ShoppingBag className="h-5 w-5" aria-hidden />
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
        <DrawerProdutosCde
          isOpen={drawerAberto}
          onClose={() => setDrawerAberto(false)}
          empresaId={empresaId}
          empresaNome={empresaNome || donorUsername || 'Empresa'}
          empresaUsername={donorUsername}
          empresaFotoUrl={empresaFotoUrl}
        />
      ) : null}
    </>
  )
}
