'use client'

import { useMemo, useState } from 'react'
import { CardPendente, type CadastroPendente } from './CardPendente'
import { useVerificacao } from '../../hooks/useVerificacao'
import type { PendenteEmpresa, PendenteProfissional, PendenteTurista } from '../../types/admin.types'
import { formatContatoExibicao, formatProfissionalCategorias, pickDocumentoFiscalEmpresa } from './verificacaoFormatters'

export function ListaPendentes({ tipo }: { tipo: 'turistas' | 'profissionais' | 'empresas' }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const { pendentes, loading, error, aprovar, reprovar } = useVerificacao({
    perfil: tipo,
  })

  const itens = useMemo<CadastroPendente[]>(() => {
    if (loading) return []
    if (tipo === 'turistas') {
      return (pendentes as PendenteTurista[]).map((p) => ({
        id: p.id,
        nome: p.nome_completo,
        username: `@${p.nome_usuario}`,
        label: 'Turista',
        dataCadastro: new Date(p.created_at).toLocaleDateString('pt-BR'),
        email: p.email?.trim() || '—',
        whatsappLine: '—',
        avatarUrl: p.foto_url,
        categoriaDisplay: undefined,
        empresaFiscal: undefined,
        alerta: null,
        docsVerificado: p.docs_verificado,
        docsVerificadoEm: p.docs_verificado_em ? new Date(p.docs_verificado_em).toLocaleDateString('pt-BR') : null,
        placaVermelha: false,
        raw: { ...p } as Record<string, unknown>,
      }))
    }
    if (tipo === 'profissionais') {
      return (pendentes as PendenteProfissional[]).map((p) => {
        const contato = p.whatsapp || p.telefone
        const categorias = Array.isArray(p.categorias) ? p.categorias : []
        return {
          id: p.id,
          nome: p.nome_completo,
          username: `@${p.nome_usuario}`,
          label: 'Profissional',
          dataCadastro: new Date(p.created_at).toLocaleDateString('pt-BR'),
          email: p.email?.trim() || '—',
          whatsappLine: formatContatoExibicao(contato),
          avatarUrl: p.foto_url,
          categoriaDisplay: formatProfissionalCategorias(categorias),
          empresaFiscal: undefined,
          alerta: null,
          docsVerificado: p.docs_verificado,
          docsVerificadoEm: p.docs_verificado_em ? new Date(p.docs_verificado_em).toLocaleDateString('pt-BR') : null,
          placaVermelha: p.placa_vermelha,
          raw: { ...p } as Record<string, unknown>,
        }
      })
    }
    return (pendentes as PendenteEmpresa[]).map((p) => {
      const raw = { ...p } as Record<string, unknown>
      const categoria = String(p.categoria ?? '').trim()
      return {
        id: p.id,
        nome: String(p.nome_fantasia ?? ''),
        username: `@${String(p.nome_usuario ?? '')}`,
        label: 'Empresa',
        dataCadastro: new Date(p.created_at).toLocaleDateString('pt-BR'),
        email: p.email?.trim() || '—',
        whatsappLine: formatContatoExibicao(p.whatsapp || p.telefone),
        avatarUrl: p.fotos_url?.[0] ?? null,
        categoriaDisplay: categoria || '—',
        empresaFiscal: pickDocumentoFiscalEmpresa(raw),
        alerta: null,
        docsVerificado: p.docs_verificado,
        docsVerificadoEm: p.docs_verificado_em ? new Date(p.docs_verificado_em).toLocaleDateString('pt-BR') : null,
        placaVermelha: false,
        raw,
      }
    })
  }, [pendentes, tipo, loading])

  return (
    <div className="space-y-3">
      {loading ? <div className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-500">Carregando pendentes...</div> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span className="font-semibold">Falha ao carregar pendentes.</span>{' '}
          <span className="whitespace-pre-wrap text-rose-700">{error.message}</span>
        </div>
      ) : null}
      {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{feedback}</div> : null}

      <div className="space-y-3">
        {itens.map((i) => (
          <CardPendente
            key={i.id}
            item={i}
            tipo={tipo}
            onAprovar={() => {
              void aprovar(i.id, tipo)
                .then(() => setFeedback('Cadastro aprovado com sucesso.'))
                .catch((err: unknown) =>
                  setFeedback(err instanceof Error ? err.message : 'Não foi possível aprovar. Verifique permissões e tente de novo.')
                )
            }}
            onReprovar={(motivo) => {
              void reprovar(i.id, tipo, motivo)
                .then(() => setFeedback('Cadastro reprovado e prazo de 7 dias aplicado.'))
                .catch((err: unknown) =>
                  setFeedback(err instanceof Error ? err.message : 'Não foi possível reprovar. Tente de novo.'),
                )
            }}
          />
        ))}
      </div>
    </div>
  )
}
