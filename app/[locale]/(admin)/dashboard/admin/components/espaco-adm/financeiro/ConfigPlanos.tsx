'use client'

import { useMemo, useState } from 'react'
import { DollarSign, Pencil, Plus } from 'lucide-react'
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

function ResumoPlanoCard({ plano, onEditar }: { plano: PlanoEmpresaAdm; onEditar: () => void }) {
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
        <button
          type="button"
          onClick={onEditar}
          className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
          aria-label={`Editar ${plano.titulo}`}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function ConfigPlanos() {
  const { planos, salvarPlano, isAdminFinanceiro, loadingPlanos } = useFinanceiroAdm()
  const [form, setForm] = useState<PlanoFormInput | null>(null)
  const [modo, setModo] = useState<'novo' | 'editar'>('novo')
  const [salvando, setSalvando] = useState(false)
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

  return (
    <div className="relative space-y-4">
      <button
        type="button"
        onClick={abrirNovo}
        className="absolute right-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#0097b2] text-white shadow-md transition hover:bg-[#007a91]"
        aria-label="Criar novo plano"
        title="Novo plano"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      </button>

      {erro ? <p className="pr-12 text-sm text-rose-600">{erro}</p> : null}

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
            <ResumoPlanoCard key={p.id} plano={p} onEditar={() => abrirEditar(p)} />
          ))}
        </div>
      )}
    </div>
  )
}
