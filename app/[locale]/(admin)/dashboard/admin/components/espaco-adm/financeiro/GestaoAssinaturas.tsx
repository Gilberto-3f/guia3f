'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  visita_agendada_em?: string | null
  visita_responsavel_nome?: string | null
  visita_responsavel_whatsapp?: string | null
  empresa: EmpresaCardInfo
}

type GrupoEmpresaAssinaturas = {
  empresaId: string
  empresa: EmpresaCardInfo
  itens: ItemGestaoAssinatura[]
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

function textoBadgeExtra(badge: string | undefined) {
  if (badge === 'ATIVO') return ' — assinatura regular'
  if (badge === 'INATIVO') return ' — pagamento pendente / assinatura bloqueada'
  if (badge === 'MODO_DEGUSTACAO') return ' — período de degustação ativo'
  if (badge === 'DEGUSTACAO_ENCERRADA') return ' — período de degustação encerrado'
  return ''
}

/** Prioridade do status agregado no card da empresa. */
function prioridadeBadge(badge: string | undefined) {
  if (badge === 'ATIVO') return 4
  if (badge === 'MODO_DEGUSTACAO') return 3
  if (badge === 'INATIVO') return 2
  if (badge === 'DEGUSTACAO_ENCERRADA') return 1
  return 0
}

function badgeAgregado(itens: ItemGestaoAssinatura[]) {
  let melhor: string | undefined
  let score = -1
  for (const item of itens) {
    const s = prioridadeBadge(item.status_badge)
    if (s > score) {
      score = s
      melhor = item.status_badge
    }
  }
  return melhor
}

function tituloChevronItem(item: ItemGestaoAssinatura, index: number, total: number) {
  if (item.tipo === 'degustacao') return total > 1 ? `Degustação ${index + 1}` : 'Degustação'
  if (item.tipo === 'solicitacao') return total > 1 ? `Solicitação ${index + 1}` : 'Solicitação'
  return total > 1 ? `Contratação ${index + 1}` : 'Contratação'
}

function formatarData(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return '—'
  }
}

function agruparPorEmpresa(items: ItemGestaoAssinatura[]): GrupoEmpresaAssinaturas[] {
  const map = new Map<string, GrupoEmpresaAssinaturas>()
  for (const item of items) {
    const empresaId = String(item.empresa?.empresa_id ?? '').trim()
    if (!empresaId) continue
    const existente = map.get(empresaId)
    if (existente) {
      existente.itens.push(item)
    } else {
      map.set(empresaId, {
        empresaId,
        empresa: item.empresa,
        itens: [item],
      })
    }
  }

  return [...map.values()].map((g) => ({
    ...g,
    itens: [...g.itens].sort((a, b) => {
      const ta = new Date(a.assinado_em).getTime()
      const tb = new Date(b.assinado_em).getTime()
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    }),
  }))
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

function DetalheAssinatura({ item }: { item: ItemGestaoAssinatura }) {
  const lembreteVencimento =
    item.dias_para_vencimento != null &&
    item.dias_para_vencimento <= 5 &&
    item.dias_para_vencimento >= 0 &&
    item.status_badge === 'ATIVO'

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-gray-100 bg-white px-3 py-3 text-sm text-gray-800">
      {item.status_badge ? (
        <p className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeStatusCls(item.status_badge)}`}>
          {labelBadge(item.status_badge)}
        </p>
      ) : null}
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
      {item.visita_agendada_em ? (
        <p className="text-xs font-medium text-[#001f3f]">
          Visita agendada: {formatarData(item.visita_agendada_em)}
        </p>
      ) : null}
      {item.visita_responsavel_nome ? (
        <p className="text-xs text-gray-600">Responsável: {item.visita_responsavel_nome}</p>
      ) : null}
      {item.visita_responsavel_whatsapp ? (
        <p className="text-xs text-gray-600">WhatsApp: {item.visita_responsavel_whatsapp}</p>
      ) : null}
      {lembreteVencimento ? (
        <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900">
          Lembrete: vencimento do plano em {item.dias_para_vencimento} dia(s).
        </p>
      ) : null}
    </div>
  )
}

function SecaoAssinaturaChevron({
  item,
  index,
  total,
  aba,
  validandoId,
  recusandoId,
  onConfirmar,
  onRecusar,
}: {
  item: ItemGestaoAssinatura
  index: number
  total: number
  aba: AbaGestao
  validandoId: string | null
  recusandoId: string | null
  onConfirmar: (id: string) => void
  onRecusar: (id: string) => void
}) {
  const [aberta, setAberta] = useState(false)
  const mostrarAcoes = aba === 'solicitacoes' && item.tipo === 'solicitacao'

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-left"
        aria-expanded={aberta}
      >
        <span className="min-w-0 truncate text-xs font-bold uppercase tracking-wide text-gray-700">
          {tituloChevronItem(item, index, total)}
          {item.plano_titulo ? ` · ${item.plano_titulo}` : ''}
        </span>
        {aberta ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        )}
      </button>

      {aberta ? (
        <>
          <DetalheAssinatura item={item} />
          {mostrarAcoes ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={validandoId === item.id || recusandoId === item.id}
                onClick={() => onConfirmar(item.id)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83b] disabled:opacity-50"
              >
                {validandoId === item.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <BadgeCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                )}
                {validandoId === item.id ? 'Confirmando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                disabled={validandoId === item.id || recusandoId === item.id}
                onClick={() => onRecusar(item.id)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#0097b2] py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#008099] disabled:opacity-50"
              >
                {recusandoId === item.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : null}
                {recusandoId === item.id ? 'Recusando…' : 'Recusar'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function CardEmpresaAssinaturas({
  grupo,
  aba,
  validandoId,
  recusandoId,
  onConfirmar,
  onRecusar,
}: {
  grupo: GrupoEmpresaAssinaturas
  aba: AbaGestao
  validandoId: string | null
  recusandoId: string | null
  onConfirmar: (id: string) => void
  onRecusar: (id: string) => void
}) {
  const badge = aba === 'assinantes' ? badgeAgregado(grupo.itens) : undefined

  return (
    <li className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {badge ? (
        <div className={`px-4 py-2 text-center text-xs font-bold uppercase tracking-wide ${badgeStatusCls(badge)}`}>
          {labelBadge(badge)}
          {textoBadgeExtra(badge)}
        </div>
      ) : null}

      <div className="space-y-3 p-4">
        <CabecalhoEmpresaCard empresa={grupo.empresa} />
        {grupo.itens.map((item, index) => (
          <SecaoAssinaturaChevron
            key={`${item.tipo}-${item.id}`}
            item={item}
            index={index}
            total={grupo.itens.length}
            aba={aba}
            validandoId={validandoId}
            recusandoId={recusandoId}
            onConfirmar={onConfirmar}
            onRecusar={onRecusar}
          />
        ))}
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
  const [recusandoId, setRecusandoId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const grupos = useMemo(() => agruparPorEmpresa(items), [items])

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

  const confirmar = async (assinaturaId: string) => {
    setValidandoId(assinaturaId)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/assinaturas-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assinatura_id: assinaturaId, acao: 'confirmar' }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível confirmar.')
        return
      }
      setFeedback('Assinatura confirmada e plano liberado.')
      await carregar()
    } catch {
      setErro('Falha ao confirmar assinatura.')
    } finally {
      setValidandoId(null)
    }
  }

  const recusar = async (assinaturaId: string) => {
    const motivo = window.prompt('Motivo da recusa (opcional):') ?? ''
    setRecusandoId(assinaturaId)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/assinaturas-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assinatura_id: assinaturaId,
          acao: 'recusar',
          motivo_recusa: motivo.trim() || null,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível recusar.')
        return
      }
      setFeedback('Solicitação recusada. A empresa foi notificada.')
      await carregar()
    } catch {
      setErro('Falha ao recusar assinatura.')
    } finally {
      setRecusandoId(null)
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
      ) : grupos.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">
          {aba === 'solicitacoes' ? 'Nenhuma solicitação pendente.' : 'Nenhum assinante registrado.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {grupos.map((grupo) => (
            <CardEmpresaAssinaturas
              key={grupo.empresaId}
              grupo={grupo}
              aba={aba}
              validandoId={validandoId}
              recusandoId={recusandoId}
              onConfirmar={(id) => void confirmar(id)}
              onRecusar={(id) => void recusar(id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
