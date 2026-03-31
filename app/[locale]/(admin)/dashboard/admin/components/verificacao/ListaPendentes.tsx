'use client'

import { useMemo, useState } from 'react'
import { CardPendente, type CadastroPendente } from './CardPendente'
import { AprovacaoLote } from './AprovacaoLote'
import { useVerificacao } from '../../hooks/useVerificacao'

export function ListaPendentes({ tipo }: { tipo: 'turistas' | 'profissionais' | 'empresas' }) {
  const [periodo, setPeriodo] = useState<'hoje' | '7d' | '30d'>('7d')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [processandoLote, setProcessandoLote] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const { pendentes, loading, error, aprovar, reprovar, aprovarLote, marcarDocsVerificado } = useVerificacao({
    perfil: tipo,
    periodo,
    busca,
    categoria,
  })

  const itens = useMemo<CadastroPendente[]>(() => {
    return (pendentes as Record<string, unknown>[]).map((p) => ({
      id: String(p.id),
      nome: String(p.nome_completo ?? p.nome_fantasia ?? ''),
      username: `@${String(p.nome_usuario ?? '')}`,
      label: tipo === 'profissionais' ? 'Profissional' : tipo === 'empresas' ? 'Empresa' : 'Turista',
      dataCadastro: new Date(String(p.created_at ?? new Date().toISOString())).toLocaleDateString('pt-BR'),
      alerta: Boolean(p.placa_vermelha) ? 'Alerta placa vermelha' : null,
      docsVerificado: Boolean(p.docs_verificado),
      docsVerificadoEm: p.docs_verificado_em ? new Date(String(p.docs_verificado_em)).toLocaleDateString('pt-BR') : null,
      placaVermelha: Boolean(p.placa_vermelha),
      raw: p,
    }))
  }, [pendentes, tipo])

  const [selecionados, setSelecionados] = useState<string[]>([])

  const toggle = (id: string) => {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Pendentes — {tipo}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as 'hoje' | '7d' | '30d')} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs">
            <option value="hoje">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
          {tipo === 'profissionais' ? (
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs">
              <option value="todas">Todas categorias</option>
              <option value="guias">Guias</option>
              <option value="taxistas">Taxistas</option>
              <option value="apps">Apps</option>
              <option value="vans">Vans</option>
            </select>
          ) : null}
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome/@"
            className="min-w-56 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
          />
        </div>
      </div>

      {loading ? <div className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-500">Carregando pendentes...</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Falha ao carregar pendentes.</div> : null}
      {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{feedback}</div> : null}

      <div className="space-y-3">
        {itens.map((i) => (
          <CardPendente
            key={i.id}
            item={i}
            tipo={tipo}
            checked={selecionados.includes(i.id)}
            onToggle={() => toggle(i.id)}
            onDocsVerificado={() => {
              void marcarDocsVerificado(i.id, tipo).then(() => setFeedback('Documentos marcados como verificados.'))
            }}
            onAprovar={() => {
              void aprovar(i.id, tipo).then(() => setFeedback('Cadastro aprovado com sucesso.'))
            }}
            onReprovar={(motivo) => {
              void reprovar(i.id, tipo, motivo).then(() => setFeedback('Cadastro reprovado e prazo de 7 dias aplicado.'))
            }}
          />
        ))}
      </div>

      <AprovacaoLote
        selecionados={selecionados}
        todosVerificados={itens.filter((x) => selecionados.includes(x.id)).every((x) => x.docsVerificado)}
        processando={processandoLote}
        onLimparSelecao={() => setSelecionados([])}
        onSelecionarTodos={() => setSelecionados(itens.filter((x) => x.docsVerificado).map((x) => x.id))}
        onAprovar={() => {
          setProcessandoLote(true)
          void aprovarLote(selecionados, tipo).finally(() => {
            setSelecionados([])
            setProcessandoLote(false)
          })
          setFeedback('Aprovação em lote concluída.')
        }}
      />
    </div>
  )
}

