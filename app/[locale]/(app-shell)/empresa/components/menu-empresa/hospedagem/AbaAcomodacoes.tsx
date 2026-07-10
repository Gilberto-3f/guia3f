'use client'

import { useCallback, useEffect, useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFotosAcomodacao } from '@/lib/hospedagemAcomodacaoFotos'
import {
  COR_AZUL_LOGO,
  parseComodidadesExtras,
  parseComodidadesPadrao,
  tipoCategoriaImovel,
  type HospedagemAcomodacaoRow,
} from '@/lib/hospedagemAcomodacoesCatalogo'
import FormAcomodacao, {
  formAcomodacaoVazio,
  formDuplicarDe,
  formFromRow,
  validarFormAcomodacao,
  type FormAcomodacaoState,
} from './FormAcomodacao'
import MiniCardAcomodacao from './MiniCardAcomodacao'

type Props = {
  empresaId: string
}

function mapRow(raw: Record<string, unknown>): HospedagemAcomodacaoRow {
  return {
    id: String(raw.id),
    empresa_id: String(raw.empresa_id),
    categoria_imovel: String(raw.categoria_imovel),
    categoria_particular: raw.categoria_particular != null ? String(raw.categoria_particular) : null,
    opcao_compartilhada: raw.opcao_compartilhada != null ? String(raw.opcao_compartilhada) : null,
    capacidade_pessoas: Number(raw.capacidade_pessoas) || 1,
    valor_diaria: Number(raw.valor_diaria) || 0,
    fotos: Array.isArray(raw.fotos) ? raw.fotos.map(String) : [],
    comodidades_padrao: parseComodidadesPadrao(raw.comodidades_padrao),
    comodidades_extras: parseComodidadesExtras(raw.comodidades_extras),
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  }
}

export default function AbaAcomodacoes({ empresaId }: Props) {
  const [lista, setLista] = useState<HospedagemAcomodacaoRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormAcomodacaoState>(formAcomodacaoVazio())
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('hospedagem_acomodacoes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setLista((data ?? []).map((r) => mapRow(r as Record<string, unknown>)))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar acomodações.')
    } finally {
      setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrirCriar = () => {
    setForm(formAcomodacaoVazio())
    setFormAberto(true)
    setErro(null)
    setMsg(null)
  }

  const abrirEditar = (row: HospedagemAcomodacaoRow) => {
    setForm(formFromRow(row))
    setFormAberto(true)
    setErro(null)
    setMsg(null)
  }

  const abrirDuplicar = (row: HospedagemAcomodacaoRow) => {
    setForm(formDuplicarDe(row))
    setFormAberto(true)
    setErro(null)
    setMsg('Acomodação duplicada — ajuste e salve como nova.')
  }

  const fecharForm = () => {
    setFormAberto(false)
    setForm(formAcomodacaoVazio())
  }

  const salvar = async () => {
    const validacao = validarFormAcomodacao(form)
    if (validacao) {
      setErro(validacao)
      return
    }
    setSalvando(true)
    setErro(null)
    setMsg(null)
    try {
      const tipo = tipoCategoriaImovel(form.categoria_imovel)
      const capacidade = Math.max(1, Math.floor(Number(form.capacidade_pessoas)))
      const valor = Number(form.valor_diaria)

      if (form.id) {
        let fotos = [...form.fotosExistentes]
        if (form.fotosNovas.length > 0) {
          const novas = await uploadFotosAcomodacao(
            supabase,
            empresaId,
            form.id,
            form.fotosNovas,
          )
          fotos = [...fotos, ...novas]
        }
        if (fotos.length < 2 || fotos.length > 5) {
          throw new Error('A acomodação precisa ter entre 2 e 5 fotos.')
        }
        const { error } = await supabase
          .from('hospedagem_acomodacoes')
          .update({
            categoria_imovel: form.categoria_imovel,
            categoria_particular: tipo === 'particular' ? form.categoria_particular : null,
            opcao_compartilhada: tipo === 'compartilhado' ? form.opcao_compartilhada : null,
            capacidade_pessoas: capacidade,
            valor_diaria: valor,
            fotos,
            comodidades_padrao: form.comodidades_padrao,
            comodidades_extras: form.comodidades_extras,
          })
          .eq('id', form.id)
          .eq('empresa_id', empresaId)
        if (error) throw error
        setMsg('Acomodação atualizada.')
      } else {
        const { data: criada, error: insErr } = await supabase
          .from('hospedagem_acomodacoes')
          .insert({
            empresa_id: empresaId,
            categoria_imovel: form.categoria_imovel,
            categoria_particular: tipo === 'particular' ? form.categoria_particular : null,
            opcao_compartilhada: tipo === 'compartilhado' ? form.opcao_compartilhada : null,
            capacidade_pessoas: capacidade,
            valor_diaria: valor,
            fotos: form.fotosExistentes.length > 0 ? form.fotosExistentes.slice(0, 5) : [],
            comodidades_padrao: form.comodidades_padrao,
            comodidades_extras: form.comodidades_extras,
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        const novoId = String(criada.id)

        let fotos = [...form.fotosExistentes]
        if (form.fotosNovas.length > 0) {
          const novas = await uploadFotosAcomodacao(supabase, empresaId, novoId, form.fotosNovas)
          fotos = [...fotos, ...novas]
        }
        if (fotos.length < 2) {
          await supabase.from('hospedagem_acomodacoes').delete().eq('id', novoId)
          throw new Error('Envie no mínimo 2 fotos da acomodação.')
        }
        if (fotos.length > 5) fotos = fotos.slice(0, 5)

        const { error: upErr } = await supabase
          .from('hospedagem_acomodacoes')
          .update({ fotos })
          .eq('id', novoId)
        if (upErr) throw upErr
        setMsg('Acomodação criada.')
      }

      fecharForm()
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a acomodação.')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (id: string) => {
    if (!window.confirm('Excluir esta acomodação?')) return
    setExcluindoId(id)
    setErro(null)
    try {
      const { error } = await supabase
        .from('hospedagem_acomodacoes')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId)
      if (error) throw error
      setMsg('Acomodação excluída.')
      if (form.id === id) fecharForm()
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.')
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div className="space-y-4">
      {!formAberto ? (
        <button
          type="button"
          onClick={abrirCriar}
          className="mx-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
          style={{ backgroundColor: COR_AZUL_LOGO }}
        >
          <CirclePlus className="h-5 w-5" aria-hidden />
          CRIAR ACOMODAÇÃO
        </button>
      ) : null}

      {formAberto ? (
        <FormAcomodacao
          form={form}
          onChange={setForm}
          onSalvar={() => void salvar()}
          onCancelar={fecharForm}
          salvando={salvando}
          titulo={form.id ? 'Editar acomodação' : 'Nova acomodação'}
        />
      ) : null}

      {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando acomodações…</p>
      ) : lista.length === 0 && !formAberto ? (
        <p className="text-center text-sm text-gray-500">
          Nenhuma acomodação cadastrada. Crie a primeira para alimentar o botão dinâmico.
        </p>
      ) : (
        <ul className="space-y-3">
          {lista.map((item) => (
            <li key={item.id}>
              <MiniCardAcomodacao
                item={item}
                onEditar={() => abrirEditar(item)}
                onDuplicar={() => abrirDuplicar(item)}
                onExcluir={() => void excluir(item.id)}
                excluindo={excluindoId === item.id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
