'use client'

import { useMemo, useState } from 'react'
import { DollarSign, Pencil, Plus, Trash2 } from 'lucide-react'
import { corPlanoHex, labelServicoPlano } from '@/lib/planosEmpresaCatalogo'
import { useFinanceiroAdm, type PlanoEmpresaAdm, type PlanoFormInput } from '../../../hooks/useFinanceiroAdm'
import { CardEditarPlano, planoFormVazio } from './CardEditarPlano'

function planoParaForm(p: PlanoEmpresaAdm): PlanoFormInput {
  return {
    id: p.id,
    nome: p.nome,
    titulo: p.titulo,
    cor: p.cor,
    descricao: p.descricao,
    servicos: p.servicos,
    precoMensal: p.precoMensal,
    precoTrimestral: p.precoTrimestral,
    precoAnual: p.precoAnual,
  }
}

function ResumoPlanoCard({
  plano,
  onEditar,
  onExcluir,
  excluindo,
}: {
  plano: PlanoEmpresaAdm
  onEditar: () => void
  onExcluir: () => void
  excluindo: boolean
}) {
  const cor = corPlanoHex(plano.cor)
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="h-1 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
      <div className="mt-3 flex items-start gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: cor }}
        >
          <DollarSign className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{plano.titulo}</p>
          <p className="mt-0.5 text-xs text-gray-600">
            Mensal: R$ {plano.precoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Trim.: R${' '}
            {plano.precoTrimestral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Anual: R${' '}
            {plano.precoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {plano.servicos.length > 0 ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">
              {plano.servicos.length} serviço(s): {plano.servicos.map((s) => labelServicoPlano(s).split(':')[0]).join(', ')}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEditar}
            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
            aria-label={`Editar ${plano.titulo}`}
            title="Editar plano"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onExcluir}
            disabled={excluindo}
            className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            aria-label={`Excluir ${plano.titulo}`}
            title="Excluir plano"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfigPlanos() {
  const { planos, salvarPlano, excluirPlano, isAdminFinanceiro, loadingPlanos } = useFinanceiroAdm()
  const [form, setForm] = useState<PlanoFormInput | null>(null)
  const [modo, setModo] = useState<'novo' | 'editar'>('novo')
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const planosVisiveis = useMemo(
    () => planos.filter((p) => !form?.id || p.id !== form.id),
    [form?.id, planos],
  )

  if (!isAdminFinanceiro) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Apenas ADM Geral ou ADM Financeiro podem editar planos.
      </div>
    )
  }

  const abrirNovo = () => {
    setErro(null)
    setModo('novo')
    setForm(planoFormVazio())
  }

  const abrirEditar = (plano: PlanoEmpresaAdm) => {
    setErro(null)
    setModo('editar')
    setForm(planoParaForm(plano))
  }

  const cancelar = () => {
    setForm(null)
    setErro(null)
  }

  const confirmar = async () => {
    if (!form) return
    setSalvando(true)
    setErro(null)
    const res = await salvarPlano(form)
    setSalvando(false)
    if (res.success) {
      setForm(null)
    } else {
      setErro(res.error instanceof Error ? res.error.message : 'Não foi possível salvar o plano.')
    }
  }

  const excluir = async (plano: PlanoEmpresaAdm) => {
    const ok = window.confirm(`Excluir definitivamente o plano "${plano.titulo}"?`)
    if (!ok) return
    setExcluindoId(plano.id)
    setErro(null)
    const res = await excluirPlano(plano.id)
    setExcluindoId(null)
    if (!res.success) {
      setErro(res.error instanceof Error ? res.error.message : 'Não foi possível excluir o plano.')
      return
    }
    if (form?.id === plano.id) setForm(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={abrirNovo}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0097b2] text-white shadow-md transition hover:bg-[#007a91]"
          aria-label="Criar novo plano"
          title="Novo plano"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      {erro ? <p className="text-center text-sm text-rose-600">{erro}</p> : null}

      {form ? (
        <CardEditarPlano
          form={form}
          modo={modo}
          salvando={salvando}
          onChange={setForm}
          onConfirmar={() => void confirmar()}
          onCancelar={cancelar}
        />
      ) : null}

      {loadingPlanos ? (
        <p className="text-sm text-gray-500">Carregando planos…</p>
      ) : planosVisiveis.length === 0 && !form ? (
        <p className="rounded-lg bg-gray-50 py-8 text-center text-sm text-gray-500">
          Nenhum plano cadastrado. Clique em + para criar o primeiro plano.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {planosVisiveis.map((p) => (
            <ResumoPlanoCard
              key={p.id}
              plano={p}
              onEditar={() => abrirEditar(p)}
              onExcluir={() => void excluir(p)}
              excluindo={excluindoId === p.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
