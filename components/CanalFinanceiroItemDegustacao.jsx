'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  mensagemDegustacaoAtiva,
  mensagemDegustacaoExpirada,
  mapDegustacaoUiDeDetalhesCanal,
  resolverEstadoDegustacaoUi,
} from '@/lib/degustacaoEmpresa'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { marcarFinanceiroItemLidoEmpresa } from '@/lib/canaisEmpresaVisibilidade'

/**
 * Convite de degustação no canal financeiro da empresa.
 * @param {{
 *   item: {
 *     id: string
 *     titulo: string
 *     mensagem: string | null
 *     lida_por_empresa: boolean
 *     created_at: string
 *     metadata?: Record<string, unknown>
 *     comprovante_detalhes?: Record<string, unknown>
 *   }
 *   userTipo: 'profissional' | 'empresa'
 *   usuarioId: string
 *   onAceito?: () => void
 *   onItemLido?: (itemId: string) => void
 * }} props
 */
export default function CanalFinanceiroItemDegustacao({ item, userTipo, usuarioId, onAceito, onItemLido }) {
  const [aceitando, setAceitando] = useState(false)
  const [erro, setErro] = useState(/** @type {string | null} */ (null))

  const detalhes =
    item.comprovante_detalhes && typeof item.comprovante_detalhes === 'object'
      ? item.comprovante_detalhes
      : item.metadata && typeof item.metadata === 'object'
        ? item.metadata
        : {}

  const degustacaoIdMeta = String(detalhes.degustacao_id ?? '')
  const planoTituloMeta = String(detalhes.plano_titulo ?? '').trim()

  const [degustacaoIdResolvido, setDegustacaoIdResolvido] = useState(() => {
    const inicial = mapDegustacaoUiDeDetalhesCanal(detalhes)
    return inicial?.id || degustacaoIdMeta
  })
  const [degustacao, setDegustacao] = useState(() => mapDegustacaoUiDeDetalhesCanal(detalhes))
  const [carregando, setCarregando] = useState(() => mapDegustacaoUiDeDetalhesCanal(detalhes) == null)
  const [marcadaLida, setMarcadaLida] = useState(item.lida_por_empresa)

  const degustacaoId = degustacaoIdResolvido || degustacaoIdMeta
  const planoTitulo = degustacao?.plano_titulo || planoTituloMeta || null
  const estadoUi = resolverEstadoDegustacaoUi(degustacao)
  const estaLida = userTipo === 'empresa' ? marcadaLida || item.lida_por_empresa || estadoUi !== 'aguardando_aceite' : false

  useEffect(() => {
    const inicial = mapDegustacaoUiDeDetalhesCanal(detalhes)
    setDegustacao(inicial)
    setDegustacaoIdResolvido(inicial?.id || degustacaoIdMeta)
    setCarregando(inicial == null)

    let ativo = true
    const carregarDegustacao = async () => {
      let query = supabase
        .from('empresa_degustacoes')
        .select('id, status, expira_em, aceito_em, planos ( titulo )')
        .limit(1)

      if (degustacaoIdMeta) {
        query = query.eq('id', degustacaoIdMeta)
      } else {
        query = query.eq('canal_financeiro_id', item.id)
      }

      const { data } = await query.maybeSingle()
      if (!ativo) return
      if (data?.id) {
        const planosJoin = data.planos
        const tituloPlano = Array.isArray(planosJoin)
          ? planosJoin[0]?.titulo
          : planosJoin?.titulo
        setDegustacaoIdResolvido(String(data.id))
        setDegustacao({
          id: String(data.id),
          status: String(data.status ?? ''),
          expira_em: data.expira_em != null ? String(data.expira_em) : null,
          aceito_em: data.aceito_em != null ? String(data.aceito_em) : null,
          plano_titulo:
            tituloPlano != null ? String(tituloPlano) : planoTituloMeta || null,
        })
      }
      setCarregando(false)
    }
    void carregarDegustacao()
    return () => {
      ativo = false
    }
  }, [degustacaoIdMeta, item.id, planoTituloMeta])

  const registrarLeitura = useCallback(async () => {
    if (userTipo !== 'empresa' || !usuarioId || marcadaLida || item.lida_por_empresa) return
    await marcarFinanceiroItemLidoEmpresa(supabase, usuarioId, item.id)
    setMarcadaLida(true)
    onItemLido?.(item.id)
    notificarBadgeCanais()
  }, [item.id, item.lida_por_empresa, marcadaLida, onItemLido, userTipo, usuarioId])

  useEffect(() => {
    void registrarLeitura()
  }, [registrarLeitura])

  const aceitar = async () => {
    if (userTipo !== 'empresa' || !degustacaoId || aceitando || estadoUi !== 'aguardando_aceite') return
    setAceitando(true)
    setErro(null)
    try {
      const res = await fetch('/api/empresa/degustacao/aceitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ degustacao_id: degustacaoId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível aceitar a degustação.')
        return
      }

      const { data: atualizada } = await supabase
        .from('empresa_degustacoes')
        .select('id, status, expira_em, aceito_em, planos ( titulo )')
        .eq('id', degustacaoId)
        .maybeSingle()

      if (atualizada?.id) {
        const planosJoin = atualizada.planos
        const tituloPlano = Array.isArray(planosJoin)
          ? planosJoin[0]?.titulo
          : planosJoin?.titulo
        setDegustacao({
          id: String(atualizada.id),
          status: String(atualizada.status ?? 'ativa'),
          expira_em: atualizada.expira_em != null ? String(atualizada.expira_em) : null,
          aceito_em: atualizada.aceito_em != null ? String(atualizada.aceito_em) : null,
          plano_titulo:
            tituloPlano != null ? String(tituloPlano) : planoTituloMeta || null,
        })
      } else {
        setDegustacao((prev) => ({
          id: degustacaoId,
          status: 'ativa',
          expira_em: prev?.expira_em ?? null,
          aceito_em: new Date().toISOString(),
          plano_titulo: (prev?.plano_titulo ?? planoTituloMeta) || null,
        }))
      }

      setMarcadaLida(true)
      setCarregando(false)
      await marcarFinanceiroItemLidoEmpresa(supabase, usuarioId, item.id)
      onItemLido?.(item.id)
      notificarBadgeCanais()
      window.dispatchEvent(new Event('empresa-gate-refresh'))
      window.dispatchEvent(new Event('perfil-atualizado'))
      onAceito?.()
    } catch {
      setErro('Erro de rede ao aceitar.')
    } finally {
      setAceitando(false)
    }
  }

  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ${!estaLida ? 'border-l-4 border-[#00D443]' : ''}`}>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
          <DollarSign size={20} className="text-amber-600" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-gray-800">{item.titulo}</h3>
            {!estaLida ? (
              <span className="rounded-full bg-[#00D443] px-2 py-0.5 text-xs text-white">Nova</span>
            ) : null}
          </div>

          {planoTitulo ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
              Plano ofertado: {planoTitulo}
            </p>
          ) : null}

          {item.mensagem ? (
            <p className="mb-3 whitespace-pre-line text-sm text-gray-600">{item.mensagem}</p>
          ) : null}

          {erro ? <p className="mb-2 text-sm text-rose-600">{erro}</p> : null}

          {userTipo === 'empresa' && estadoUi === 'aguardando_aceite' && !carregando ? (
            <button
              type="button"
              onClick={() => void aceitar()}
              disabled={aceitando || !degustacaoId}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0097b2] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              {aceitando ? 'Aceitando…' : degustacaoId ? 'ACEITAR' : 'Carregando…'}
            </button>
          ) : estadoUi === 'ativa' ? (
            <p className="text-sm font-semibold text-[#00D443]">
              {mensagemDegustacaoAtiva(degustacao?.expira_em, planoTitulo)}
            </p>
          ) : estadoUi === 'expirada' ? (
            <p className="text-sm font-semibold text-amber-700">
              {mensagemDegustacaoExpirada(degustacao?.expira_em, planoTitulo)}
            </p>
          ) : null}

          <p className="mt-3 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </div>
  )
}
