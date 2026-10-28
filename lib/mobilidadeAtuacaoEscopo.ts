import { cidadePertenceAoBloco } from '@/lib/ecossistemaFiltro'
import type { EcossistemaBloco, EcossistemaCidade } from '@/lib/ecossistemas'
import { inferCodigoPaisEmpresa } from '@/lib/empresaPaisUi'
import { aliasesCidadeGuia, normalizarChaveCidadeGuia } from '@/lib/segmentosEmpresaGuia'

export type AtuacaoEscopo = 'cidade' | 'regiao'

export function parseAtuacaoEscopo(raw: unknown): AtuacaoEscopo {
  return String(raw ?? '').trim().toLowerCase() === 'regiao' ? 'regiao' : 'cidade'
}

export function cidadesMatchingEquivalentes(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarChaveCidadeGuia(a)
  const nb = normalizarChaveCidadeGuia(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const aliasesA = new Set(aliasesCidadeGuia(a).map((x) => normalizarChaveCidadeGuia(x)).filter(Boolean))
  const aliasesB = new Set(aliasesCidadeGuia(b).map((x) => normalizarChaveCidadeGuia(x)).filter(Boolean))
  for (const x of aliasesA) {
    if (aliasesB.has(x)) return true
  }
  return Boolean(na && nb && (na.includes(nb) || nb.includes(na)))
}

function miniBloco(bloco: EcossistemaBloco, cidade: EcossistemaCidade): EcossistemaBloco {
  return { ...bloco, cidades: [cidade] }
}

function cidadeDoBlocoPorNome(bloco: EcossistemaBloco, raw: string): EcossistemaCidade | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  return bloco.cidades.find((c) => cidadePertenceAoBloco(s, miniBloco(bloco, c))) ?? null
}

function paisDaCidadeNoBloco(bloco: EcossistemaBloco, raw: string): string | null {
  const c = cidadeDoBlocoPorNome(bloco, raw)
  if (c) {
    const col = String(c.pais ?? '').trim().toUpperCase()
    if (col) return col
    return inferCodigoPaisEmpresa(c.chave) ?? inferCodigoPaisEmpresa(c.label)
  }
  return inferCodigoPaisEmpresa(raw)
}

/** Cidade do pedido no bloco (sem GPS da Tríplice). */
export function resolverCidadePedidoMatching(
  bloco: EcossistemaBloco | null | undefined,
  hints: Array<string | null | undefined>,
): string {
  if (bloco?.tipo === 'cidade' && bloco.cidades[0]) {
    return String(bloco.cidades[0].chave)
  }
  if (bloco && bloco.tipo === 'regiao') {
    for (const h of hints) {
      const s = String(h ?? '').trim()
      if (!s) continue
      const hit = cidadeDoBlocoPorNome(bloco, s)
      if (hit) return String(hit.chave)
    }
    return ''
  }
  for (const h of hints) {
    const s = String(h ?? '').trim()
    if (s) return s
  }
  return ''
}

/**
 * Matching fora da Tríplice: só a cidade de residência, ou a região do mesmo país.
 * Com `regraFronteira`, o caller aplica as regras já testadas da Tríplice.
 */
export function profissionalAtendePedidoMobilidade(opts: {
  regraFronteira: boolean
  cidadeResidencia: string | null | undefined
  escopo: AtuacaoEscopo
  cidadePedido: string | null | undefined
  bloco: EcossistemaBloco | null | undefined
}): boolean {
  if (opts.regraFronteira) return true

  const casa = String(opts.cidadeResidencia ?? '').trim()
  const pedido = String(opts.cidadePedido ?? '').trim()
  const bloco = opts.bloco ?? null

  if (bloco && casa && !cidadePertenceAoBloco(casa, bloco)) return false

  const soCidade = opts.escopo !== 'regiao' || !bloco || bloco.tipo !== 'regiao'

  if (soCidade) {
    if (!casa) return false
    if (!pedido) {
      return bloco?.tipo === 'cidade' ? cidadePertenceAoBloco(casa, bloco) : false
    }
    if (bloco) {
      const cidadePedido = cidadeDoBlocoPorNome(bloco, pedido)
      const cidadeCasa = cidadeDoBlocoPorNome(bloco, casa)
      if (cidadePedido && cidadeCasa) return cidadePedido.chave === cidadeCasa.chave
    }
    return cidadesMatchingEquivalentes(pedido, casa)
  }

  if (pedido && !cidadePertenceAoBloco(pedido, bloco)) return false
  if (pedido && casa) {
    const p1 = paisDaCidadeNoBloco(bloco, pedido)
    const p2 = paisDaCidadeNoBloco(bloco, casa)
    if (p1 && p2 && p1 !== p2) return false
  }
  return true
}
