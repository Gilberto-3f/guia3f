'use client'

import { useEffect, useMemo, useState } from 'react'
import { Package, Ticket, Users, Utensils, Wrench, type LucideIcon } from 'lucide-react'
import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'
import type {
  RecomendacaoPratoProfissional,
  RecomendacaoProdutoProfissional,
  RecomendacaoProfissional,
  RecomendacaoServicoProfissional,
  RecomendacaoTicketProfissional,
} from '../../types/dashboard.types'
import { contarNovosEventos } from './contarNovosFunil'
import LinhaProfissionalRecomendacao from './LinhaProfissionalRecomendacao'
import LinhaProfissionalRecomendacaoProduto from './LinhaProfissionalRecomendacaoProduto'
import LinhaProfissionalRecomendacaoPrato from './LinhaProfissionalRecomendacaoPrato'
import LinhaProfissionalRecomendacaoServico from './LinhaProfissionalRecomendacaoServico'
import LinhaProfissionalRecomendacaoTicket from './LinhaProfissionalRecomendacaoTicket'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

const VERDE = '#00D443'

type AbaRec = 'pagina' | 'produtos' | 'cardapio' | 'servicos' | 'tickets'

interface Props {
  recomendacoes: RecomendacaoProfissional[]
  recomendacoesProduto?: RecomendacaoProdutoProfissional[]
  recomendacoesPrato?: RecomendacaoPratoProfissional[]
  recomendacoesServico?: RecomendacaoServicoProfissional[]
  recomendacoesTicket?: RecomendacaoTicketProfissional[]
  empresaEhGastronomia?: boolean
  empresaEhServicosLocais?: boolean
  empresaEhAtrativos?: boolean
  referenciaVistoEm?: string | null
  pastasVistas?: Set<string>
  profissionaisVistos?: Set<string>
  onPastaVista?: (categoria: string) => void
  onProfissionalVisto?: (profissionalId: string) => void
}

function contarNaoLidasAba(
  items: { profissional_id: string; detalhes: { created_at: string }[] }[],
  vistoEm: string | null | undefined,
  profissionaisVistos: Set<string> | undefined,
  prefixProf = '',
): number {
  if (!vistoEm) return 0
  let total = 0
  for (const item of items) {
    const key = `${prefixProf}${item.profissional_id}`
    if (profissionaisVistos?.has(key)) continue
    total += contarNovosEventos(item.detalhes, vistoEm)
  }
  return total
}

export default function CardRecomendacoes({
  recomendacoes,
  recomendacoesProduto = [],
  recomendacoesPrato = [],
  recomendacoesServico = [],
  recomendacoesTicket = [],
  empresaEhGastronomia = false,
  empresaEhServicosLocais = false,
  empresaEhAtrativos = false,
  referenciaVistoEm,
  pastasVistas,
  profissionaisVistos,
  onPastaVista,
  onProfissionalVisto,
}: Props) {
  const temProdutos = recomendacoesProduto.length > 0
  const temCardapio = empresaEhGastronomia || recomendacoesPrato.length > 0
  const temServicos = empresaEhServicosLocais || recomendacoesServico.length > 0
  const temTickets = empresaEhAtrativos || recomendacoesTicket.length > 0
  const temAbasExtra = temProdutos || temCardapio || temServicos || temTickets
  const [aba, setAba] = useState<AbaRec>('pagina')

  useEffect(() => {
    if (aba === 'produtos' && !temProdutos) setAba('pagina')
    if (aba === 'cardapio' && !temCardapio) setAba('pagina')
    if (aba === 'servicos' && !temServicos) setAba('pagina')
    if (aba === 'tickets' && !temTickets) setAba('pagina')
  }, [temProdutos, temCardapio, temServicos, temTickets, aba])

  const abas = useMemo(() => {
    const lista: { id: AbaRec; label: string; Icon: LucideIcon }[] = [
      { id: 'pagina', label: 'PÁGINA', Icon: Users },
    ]
    if (temProdutos) lista.push({ id: 'produtos', label: 'PRODUTOS', Icon: Package })
    if (temCardapio) lista.push({ id: 'cardapio', label: 'CARDÁPIO', Icon: Utensils })
    if (temServicos) lista.push({ id: 'servicos', label: 'SERVIÇOS', Icon: Wrench })
    if (temTickets) lista.push({ id: 'tickets', label: 'TICKETS', Icon: Ticket })
    return lista
  }, [temProdutos, temCardapio, temServicos, temTickets])

  const naoLidasPagina = useMemo(
    () => contarNaoLidasAba(recomendacoes, referenciaVistoEm, profissionaisVistos),
    [recomendacoes, referenciaVistoEm, profissionaisVistos],
  )

  const naoLidasProdutos = useMemo(
    () =>
      contarNaoLidasAba(recomendacoesProduto, referenciaVistoEm, profissionaisVistos, 'prod:'),
    [recomendacoesProduto, referenciaVistoEm, profissionaisVistos],
  )

  const naoLidasCardapio = useMemo(
    () =>
      contarNaoLidasAba(recomendacoesPrato, referenciaVistoEm, profissionaisVistos, 'prato:'),
    [recomendacoesPrato, referenciaVistoEm, profissionaisVistos],
  )

  const naoLidasServicos = useMemo(
    () =>
      contarNaoLidasAba(recomendacoesServico, referenciaVistoEm, profissionaisVistos, 'servico:'),
    [recomendacoesServico, referenciaVistoEm, profissionaisVistos],
  )

  const naoLidasTickets = useMemo(
    () =>
      contarNaoLidasAba(recomendacoesTicket, referenciaVistoEm, profissionaisVistos, 'ticket:'),
    [recomendacoesTicket, referenciaVistoEm, profissionaisVistos],
  )

  const naoLidasAba = (id: AbaRec) => {
    if (id === 'pagina') return naoLidasPagina
    if (id === 'produtos') return naoLidasProdutos
    if (id === 'cardapio') return naoLidasCardapio
    if (id === 'servicos') return naoLidasServicos
    return naoLidasTickets
  }

  return (
    <div className="space-y-3">
      {temAbasExtra ? (
        <div className="flex gap-1.5 rounded-2xl bg-gray-100 p-1.5" role="tablist" aria-label="Tipo de recomendação">
          {abas.map(({ id, label, Icon }) => {
            const ativa = aba === id
            const naoLidas = naoLidasAba(id)
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setAba(id)}
                className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white transition sm:text-sm ${
                  ativa ? 'shadow-md' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: VERDE }}
              >
                <Icon className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{label}</span>
                {naoLidas > 0 ? (
                  <CanalNaoLidasBadge
                    count={naoLidas}
                    className="!absolute !right-1.5 !top-1 !min-h-[16px] !min-w-[16px] !text-[10px] ring-2 ring-white"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {!temAbasExtra || aba === 'pagina' ? (
        <RelatorioPastasCategoria
          prefixoId="rec"
          items={recomendacoes}
          referenciaVistoEm={referenciaVistoEm}
          pastasVistas={pastasVistas}
          profissionaisVistos={profissionaisVistos}
          onPastaVista={onPastaVista}
          onProfissionalVisto={onProfissionalVisto}
          rotuloBloco="recomendações"
          vazioCategoria="Nenhuma recomendação nesta categoria"
          renderLinha={(prof, naoLidas, onVisto, posicao) => (
            <LinhaProfissionalRecomendacao
              key={prof.profissional_id}
              profissional={prof}
              naoLidas={naoLidas}
              onAberto={onVisto}
              posicao={posicao}
            />
          )}
        />
      ) : null}

      {temProdutos && aba === 'produtos' ? (
        <RelatorioPastasCategoria
          prefixoId="rec-prod"
          items={recomendacoesProduto}
          referenciaVistoEm={referenciaVistoEm}
          pastasVistas={
            pastasVistas
              ? new Set(
                  [...pastasVistas]
                    .filter((k) => k.startsWith('prod:'))
                    .map((k) => k.slice('prod:'.length)),
                )
              : undefined
          }
          profissionaisVistos={
            profissionaisVistos
              ? new Set(
                  [...profissionaisVistos]
                    .filter((k) => k.startsWith('prod:'))
                    .map((k) => k.slice('prod:'.length)),
                )
              : undefined
          }
          onPastaVista={(cat) => onPastaVista?.(`prod:${cat}`)}
          onProfissionalVisto={(id) => onProfissionalVisto?.(`prod:${id}`)}
          rotuloBloco="produtos recomendados"
          vazioCategoria="Nenhuma recomendação de produto nesta categoria"
          renderLinha={(prof, naoLidas, onVisto, posicao) => (
            <LinhaProfissionalRecomendacaoProduto
              key={`prod-${prof.profissional_id}`}
              profissional={prof}
              naoLidas={naoLidas}
              onAberto={onVisto}
              posicao={posicao}
            />
          )}
        />
      ) : null}

      {temCardapio && aba === 'cardapio' ? (
        <RelatorioPastasCategoria
          prefixoId="rec-prato"
          items={recomendacoesPrato}
          referenciaVistoEm={referenciaVistoEm}
          pastasVistas={
            pastasVistas
              ? new Set(
                  [...pastasVistas]
                    .filter((k) => k.startsWith('prato:'))
                    .map((k) => k.slice('prato:'.length)),
                )
              : undefined
          }
          profissionaisVistos={
            profissionaisVistos
              ? new Set(
                  [...profissionaisVistos]
                    .filter((k) => k.startsWith('prato:'))
                    .map((k) => k.slice('prato:'.length)),
                )
              : undefined
          }
          onPastaVista={(cat) => onPastaVista?.(`prato:${cat}`)}
          onProfissionalVisto={(id) => onProfissionalVisto?.(`prato:${id}`)}
          rotuloBloco="pratos recomendados"
          vazioCategoria="Nenhuma recomendação de prato nesta categoria"
          renderLinha={(prof, naoLidas, onVisto, posicao) => (
            <LinhaProfissionalRecomendacaoPrato
              key={`prato-${prof.profissional_id}`}
              profissional={prof}
              naoLidas={naoLidas}
              onAberto={onVisto}
              posicao={posicao}
            />
          )}
        />
      ) : null}

      {temServicos && aba === 'servicos' ? (
        <RelatorioPastasCategoria
          prefixoId="rec-servico"
          items={recomendacoesServico}
          referenciaVistoEm={referenciaVistoEm}
          pastasVistas={
            pastasVistas
              ? new Set(
                  [...pastasVistas]
                    .filter((k) => k.startsWith('servico:'))
                    .map((k) => k.slice('servico:'.length)),
                )
              : undefined
          }
          profissionaisVistos={
            profissionaisVistos
              ? new Set(
                  [...profissionaisVistos]
                    .filter((k) => k.startsWith('servico:'))
                    .map((k) => k.slice('servico:'.length)),
                )
              : undefined
          }
          onPastaVista={(cat) => onPastaVista?.(`servico:${cat}`)}
          onProfissionalVisto={(id) => onProfissionalVisto?.(`servico:${id}`)}
          rotuloBloco="serviços recomendados"
          vazioCategoria="Nenhuma recomendação de serviço nesta categoria"
          renderLinha={(prof, naoLidas, onVisto, posicao) => (
            <LinhaProfissionalRecomendacaoServico
              key={`servico-${prof.profissional_id}`}
              profissional={prof}
              naoLidas={naoLidas}
              onAberto={onVisto}
              posicao={posicao}
            />
          )}
        />
      ) : null}

      {temTickets && aba === 'tickets' ? (
        <RelatorioPastasCategoria
          prefixoId="rec-ticket"
          items={recomendacoesTicket}
          referenciaVistoEm={referenciaVistoEm}
          pastasVistas={
            pastasVistas
              ? new Set(
                  [...pastasVistas]
                    .filter((k) => k.startsWith('ticket:'))
                    .map((k) => k.slice('ticket:'.length)),
                )
              : undefined
          }
          profissionaisVistos={
            profissionaisVistos
              ? new Set(
                  [...profissionaisVistos]
                    .filter((k) => k.startsWith('ticket:'))
                    .map((k) => k.slice('ticket:'.length)),
                )
              : undefined
          }
          onPastaVista={(cat) => onPastaVista?.(`ticket:${cat}`)}
          onProfissionalVisto={(id) => onProfissionalVisto?.(`ticket:${id}`)}
          rotuloBloco="tickets recomendados"
          vazioCategoria="Nenhuma recomendação de ticket nesta categoria"
          renderLinha={(prof, naoLidas, onVisto, posicao) => (
            <LinhaProfissionalRecomendacaoTicket
              key={`ticket-${prof.profissional_id}`}
              profissional={prof}
              naoLidas={naoLidas}
              onAberto={onVisto}
              posicao={posicao}
            />
          )}
        />
      ) : null}
    </div>
  )
}
