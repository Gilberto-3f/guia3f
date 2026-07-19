'use client'

import { useEffect, useState } from 'react'
import { Package, Users, type LucideIcon } from 'lucide-react'
import type {
  RecomendacaoProdutoProfissional,
  RecomendacaoProfissional,
} from '../../types/dashboard.types'
import LinhaProfissionalRecomendacao from './LinhaProfissionalRecomendacao'
import LinhaProfissionalRecomendacaoProduto from './LinhaProfissionalRecomendacaoProduto'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

const VERDE = '#00D443'

type AbaRec = 'pagina' | 'produtos'

interface Props {
  recomendacoes: RecomendacaoProfissional[]
  recomendacoesProduto?: RecomendacaoProdutoProfissional[]
  referenciaVistoEm?: string | null
  pastasVistas?: Set<string>
  profissionaisVistos?: Set<string>
  onPastaVista?: (categoria: string) => void
  onProfissionalVisto?: (profissionalId: string) => void
}

const ABAS: { id: AbaRec; label: string; Icon: LucideIcon }[] = [
  { id: 'pagina', label: 'PÁGINA', Icon: Users },
  { id: 'produtos', label: 'PRODUTOS', Icon: Package },
]

export default function CardRecomendacoes({
  recomendacoes,
  recomendacoesProduto = [],
  referenciaVistoEm,
  pastasVistas,
  profissionaisVistos,
  onPastaVista,
  onProfissionalVisto,
}: Props) {
  const temProdutos = recomendacoesProduto.length > 0
  const [aba, setAba] = useState<AbaRec>('pagina')

  useEffect(() => {
    if (!temProdutos && aba === 'produtos') setAba('pagina')
  }, [temProdutos, aba])

  return (
    <div className="space-y-3">
      {temProdutos ? (
        <div className="flex gap-1.5 rounded-2xl bg-gray-100 p-1.5" role="tablist" aria-label="Tipo de recomendação">
          {ABAS.map(({ id, label, Icon }) => {
            const ativa = aba === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setAba(id)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white transition sm:text-sm ${
                  ativa ? 'shadow-md' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: VERDE }}
              >
                <Icon className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {!temProdutos || aba === 'pagina' ? (
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
    </div>
  )
}
