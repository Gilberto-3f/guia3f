'use client'

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import { usePermissao } from '../../../hooks/usePermissao'

type AbaGestao = 'solicitacoes' | 'assinantes'

type VerificadorInfo = {
  id: string | null
  email: string | null
  username: string | null
}

type EmpresaCardInfo = {
  empresa_id: string
  usuario_id: string | null
  nome: string
  username: string
  foto_url: string | null
  verificado_em: string | null
  verificado_por: VerificadorInfo
}

type ItemGestaoAssinatura = {
  tipo: 'solicitacao' | 'assinatura' | 'degustacao'
  id: string
  assinado_em: string
  plano_titulo: string
  modalidade_label: string
  forma_pagamento_label: string
  valor: number
  vencimento_em?: string | null
  expira_em?: string | null
  dias_para_vencimento?: number | null
  status_badge?: string
  empresa: EmpresaCardInfo
}

function tabCls(ativa: boolean) {
  return [
    'flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-bold uppercase tracking-wide transition',
    ativa ? 'bg-[#00D443] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
  ].join(' ')
}

function badgeStatusCls(badge: string | undefined) {
  if (badge === 'ATIVO') return 'bg-emerald-100 text-emerald-800'
  if (badge === 'INATIVO') return 'bg-rose-100 text-rose-800'
  if (badge === 'MODO_DEGUSTACAO') return 'bg-[#0097b2]/15 text-[#0097b2]'
  if (badge === 'DEGUSTACAO_ENCERRADA') return 'bg-amber-100 text-amber-900'
  return 'bg-gray-100 text-gray-700'
}

function labelBadge(badge: string | undefined) {
  if (badge === 'ATIVO') return 'ATIVO'
  if (badge === 'INATIVO') return 'INATIVO'
  if (badge === 'MODO_DEGUSTACAO') return 'MODO DEGUSTAÇÃO'
  if (badge === 'DEGUSTACAO_ENCERRADA') return 'DEGUSTAÇÃO ENCERRADA'
  return badge ?? ''
}

function formatarData(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return '—'
  }
}

function CabecalhoEmpresaCard({ empresa }: { empresa: EmpresaCardInfo }) {
  const verificador =
    empresa.verificado_por?.email ??
    (empresa.verificado_por?.username ? `@${empresa.verificado_por.username}` : null) ??
    '—'

  return (
    <div className="flex gap-3">
      <AvatarImage
        src={empresa.foto_url}
        alt={empresa.nome}
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-gray-100"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#001f3f]">{empresa.nome}</p>
        <p className="truncate text-xs text-gray-500">@{empresa.username || 'empresa'}</p>
        <p className="mt-1 text-[11px] leading-snug text-gray-600">
          Verificado em {formatarData(empresa.verificado_em)}
          {verificador !== '—' ? ` · por ${verificador}` : ''}
        </p>
      </div>
    </div>
  )
}

function CardAssinaturaItem({
  item,
  aba,
  validandoId,
  onValidar,
}: {
  item: ItemGestaoAssinatura
  aba: AbaGestao
  validandoId: string | null
  onValidar: (id: string) => void
}) {
  const [assinaturaAberta, setAssinaturaAberta] = useState(true)
  const mostrarValidar = aba === 'solicitacoes' && item.tipo === 'solicitacao'
  const lembreteVencimento =
    item.dias_para_vencimento != null &&
    item.dias_para_vencimento <= 7 &&
    item.dias_para_vencimento >= 0 &&
    item.forma_pagamento_label === 'Dinheiro'

  return (
    <li className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {aba === 'assinantes' && item.status_badge ? (
        <div className={`px-4 py-2 text-center text-xs font-bold uppercase tracking-wide ${badgeStatusCls(item.status_badge)}`}>
          {labelBadge(item.status_badge)}
          {item.status_badge === 'ATIVO' ? ' — assinatura regular' : ''}
          {item.status_badge === 'INATIVO' ? ' — pagamento pendente / assinatura bloqueada' : ''}
          {item.status_badge === 'MODO_DEGUSTACAO' ? ' — período de degustação ativo' : ''}
          {item.status_badge === 'DEGUSTACAO_ENCERRADA' ? ' — período de degustação encerrado' : ''}
        </div>
      ) : null}

      <div className="p-4">
        <CabecalhoEmpresaCard empresa={item.empresa} />

        <button
          type="button"
          onClick={() => setAssinaturaAberta((v) => !v)}
          className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-left"
          aria-expanded={assinaturaAberta}
        >
          <span className="text-xs font-bold uppercase tracking-wide text-gray-700">Assinatura</span>
          {assinaturaAberta ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          )}
        </button>

        {assinaturaAberta ? (
          <div className="mt-2 space-y-1.5 rounded-lg border border-gray-100 bg-white px-3 py-3 text-sm text-gray-800">
            <p>
              <span className="font-semibold text-gray-600">Plano:</span> {item.plano_titulo}
            </p>
            <p>
              <span className="font-semibold text-gray-600">Modalidade:</span> {item.modalidade_label}
            </p>
            <p>
              <span className="font-semibold text-gray-600">Forma de pagamento:</span> {item.forma_pagamento_label}
            </p>
            {item.valor > 0 ? (
              <p>
                <span className="font-semibold text-gray-600">Valor:</span> R${' '}
                {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            ) : null}
            <p className="text-xs text-gray-500">Assinatura em {formatarData(item.assinado_em)}</p>
            {item.vencimento_em ? (
              <p className="text-xs text-gray-500">Vencimento: {formatarData(item.vencimento_em)}</p>
            ) : null}
            {item.expira_em ? (
              <p className="text-xs text-gray-500">Expira em {formatarData(item.expira_em)}</p>
            ) : null}
            {lembreteVencimento ? (
              <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900">
                Lembrete: vencimento do plano em {item.dias_para_vencimento} dia(s).
              </p>
            ) : null}
          </div>
        ) : null}

        {mostrarValidar ? (
          <button
            type="button"
            disabled={validandoId === item.id}
            onClick={() => onValidar(item.id)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83b] disabled:opacity-50"
          >
            {validandoId === item.id ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <BadgeCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
            )}
            {validandoId === item.id ? 'Validando…' : 'Validar'}
          </button>
        ) : null}
      </div>
    </li>
  )
}

export function GestaoAssinaturas() {
  const { admin } = usePermissao()
  const isAdminFinanceiro = Boolean(
    admin && (admin.admin_level === 1 || (admin.admin_permissoes as { cargo?: string })?.cargo === 'FINANCEIRO'),
  )

  const [aba, setAba] = useState<AbaGestao>('solicitacoes')
  const [items, setItems] = useState<ItemGestaoAssinatura[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [validandoId, setValidandoId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!isAdminFinanceiro) return
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/assinaturas-empresa?aba=${aba}`)
      const json = (await res.json()) as { ok?: boolean; items?: ItemGestaoAssinatura[]; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível carregar assinaturas.')
        setItems([])
        return
      }
      setItems(json.items ?? [])
    } catch {
      setErro('Falha de conexão.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [aba, isAdminFinanceiro])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const validar = async (assinaturaId: string) => {
    setValidandoId(assinaturaId)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/assinaturas-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assinatura_id: assinaturaId }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível validar.')
        return
      }
      setFeedback('Assinatura validada e plano liberado.')
      await carregar()
    } catch {
      setErro('Falha ao validar assinatura.')
    } finally {
      setValidandoId(null)
    }
  }

  if (!isAdminFinanceiro) {
    return <p className="text-sm text-gray-500">Acesso restrito ao ADM Financeiro.</p>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Gestão de assinaturas">
        <button type="button" role="tab" aria-selected={aba === 'solicitacoes'} onClick={() => setAba('solicitacoes')} className={tabCls(aba === 'solicitacoes')}>
          Solicitações
        </button>
        <button type="button" role="tab" aria-selected={aba === 'assinantes'} onClick={() => setAba('assinantes')} className={tabCls(aba === 'assinantes')}>
          Assinantes
        </button>
      </div>

      {feedback ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{feedback}</p> : null}
      {erro ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p> : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Carregando…
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">
          {aba === 'solicitacoes' ? 'Nenhuma solicitação pendente.' : 'Nenhum assinante registrado.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <CardAssinaturaItem
              key={`${item.tipo}-${item.id}`}
              item={item}
              aba={aba}
              validandoId={validandoId}
              onValidar={(id) => void validar(id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
