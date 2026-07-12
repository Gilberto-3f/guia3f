'use client'

import { useCallback, useEffect, useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFotosAtrativo } from '@/lib/atrativosFotos'
import {
  COR_AZUL_LOGO,
  FOTOS_MAX,
  FOTOS_MIN,
  mapExperienciaRow,
  type AtrativoExperienciaRow,
} from '@/lib/atrativosCatalogo'
import FormAtrativo, {
  formAtrativoVazio,
  formDuplicarDe,
  formFromRow,
  validarFormAtrativo,
  type FormAtrativoState,
} from './FormAtrativo'
import MiniCardAtrativoConfig from './MiniCardAtrativoConfig'

type Props = {
  empresaId: string
}

export default function AbaAtrativos({ empresaId }: Props) {
  const [lista, setLista] = useState<AtrativoExperienciaRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormAtrativoState>(formAtrativoVazio())
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('atrativos_experiencias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setLista((data ?? []).map((r) => mapExperienciaRow(r as Record<string, unknown>)))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar atrativos.')
    } finally {
      setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrirCriar = () => {
    setForm(formAtrativoVazio())
    setFormAberto(true)
    setErro(null)
    setMsg(null)
  }

  const abrirEditar = (row: AtrativoExperienciaRow) => {
    setForm(formFromRow(row))
    setFormAberto(true)
    setErro(null)
    setMsg(null)
  }

  const abrirDuplicar = (row: AtrativoExperienciaRow) => {
    setForm(formDuplicarDe(row))
    setFormAberto(true)
    setErro(null)
    setMsg('Atrativo replicado — ajuste e salve como novo.')
  }

  const fecharForm = () => {
    setFormAberto(false)
    setForm(formAtrativoVazio())
  }

  const payloadBase = (f: FormAtrativoState) => ({
    titulo: f.titulo.trim(),
    descricao: f.descricao.trim(),
    oferece_inteira: f.oferece_inteira,
    preco_inteira: f.oferece_inteira ? Number(f.preco_inteira) : null,
    oferece_meia: f.oferece_meia,
    preco_meia: f.oferece_meia ? Number(f.preco_meia) : null,
  })

  const salvar = async () => {
    const validacao = validarFormAtrativo(form)
    if (validacao) {
      setErro(validacao)
      return
    }
    setSalvando(true)
    setErro(null)
    setMsg(null)
    try {
      if (form.id) {
        let fotos = [...form.fotosExistentes]
        if (form.fotosNovas.length > 0) {
          const novas = await uploadFotosAtrativo(supabase, empresaId, form.id, form.fotosNovas)
          fotos = [...fotos, ...novas]
        }
        if (fotos.length < FOTOS_MIN || fotos.length > FOTOS_MAX) {
          throw new Error(`O atrativo precisa ter entre ${FOTOS_MIN} e ${FOTOS_MAX} fotos.`)
        }
        const { error } = await supabase
          .from('atrativos_experiencias')
          .update({ ...payloadBase(form), fotos })
          .eq('id', form.id)
          .eq('empresa_id', empresaId)
        if (error) throw error
        setMsg('Atrativo atualizado.')
      } else {
        const { data: criada, error: insErr } = await supabase
          .from('atrativos_experiencias')
          .insert({
            empresa_id: empresaId,
            ...payloadBase(form),
            fotos: form.fotosExistentes.length > 0 ? form.fotosExistentes.slice(0, FOTOS_MAX) : [],
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        const novoId = String(criada.id)

        let fotos = [...form.fotosExistentes]
        if (form.fotosNovas.length > 0) {
          const novas = await uploadFotosAtrativo(supabase, empresaId, novoId, form.fotosNovas)
          fotos = [...fotos, ...novas]
        }
        if (fotos.length < FOTOS_MIN) {
          await supabase.from('atrativos_experiencias').delete().eq('id', novoId)
          throw new Error(`Envie no mínimo ${FOTOS_MIN} foto do atrativo.`)
        }
        if (fotos.length > FOTOS_MAX) fotos = fotos.slice(0, FOTOS_MAX)

        const { error: upErr } = await supabase
          .from('atrativos_experiencias')
          .update({ fotos })
          .eq('id', novoId)
        if (upErr) throw upErr
        setMsg('Atrativo criado.')
      }

      fecharForm()
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o atrativo.')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (id: string) => {
    if (!window.confirm('Excluir este atrativo?')) return
    setExcluindoId(id)
    setErro(null)
    try {
      const { error } = await supabase
        .from('atrativos_experiencias')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId)
      if (error) throw error
      setMsg('Atrativo excluído.')
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
          CRIAR ATRATIVO
        </button>
      ) : null}

      {formAberto ? (
        <FormAtrativo
          form={form}
          onChange={setForm}
          onSalvar={() => void salvar()}
          onCancelar={fecharForm}
          salvando={salvando}
          titulo={form.id ? 'Editar atrativo' : 'Novo atrativo'}
        />
      ) : null}

      {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando atrativos…</p>
      ) : lista.length === 0 && !formAberto ? (
        <p className="text-center text-sm text-gray-500">
          Nenhum atrativo cadastrado. Crie o primeiro para alimentar o botão dinâmico.
        </p>
      ) : (
        <ul className="space-y-3">
          {lista.map((item) => (
            <li key={item.id}>
              <MiniCardAtrativoConfig
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
