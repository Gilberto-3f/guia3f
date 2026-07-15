'use client'

import { useCallback, useEffect, useState } from 'react'
import { CirclePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFotosProduto } from '@/lib/comprasCdeFotos'
import {
  COR_AZUL_LOGO,
  mapProdutoRow,
  montarPalavrasChave,
  type ProdutoCategoriaRow,
  type ProdutoCdeRow,
} from '@/lib/comprasCdeCatalogo'
import {
  listarCategoriasProduto,
  resolverOuCriarMarca,
  resolverOuCriarSubcategoria,
} from '@/lib/comprasCdeTaxonomia'
import FormProduto, {
  formProdutoFromRow,
  formProdutoVazio,
  validarFormProduto,
  type FormProdutoState,
} from './FormProduto'
import MiniCardProdutoConfig from './MiniCardProdutoConfig'

type Props = {
  empresaId: string
}

const SELECT_PRODUTO = `
  id, empresa_id, nome, descricao, preco_usd, percentual_desconto,
  fotos, foto_url, site_url, ativo, categoria_id, subcategoria_id, marca_id,
  palavras_chave, created_at,
  produto_categorias ( nome ),
  produto_subcategorias ( nome ),
  produto_marcas ( nome )
`

export default function AbaProdutos({ empresaId }: Props) {
  const [lista, setLista] = useState<ProdutoCdeRow[]>([])
  const [categorias, setCategorias] = useState<ProdutoCategoriaRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormProdutoState>(formProdutoVazio())
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    setErro(null)
    try {
      const [cats, prodRes] = await Promise.all([
        listarCategoriasProduto(supabase),
        supabase
          .from('produtos')
          .select(SELECT_PRODUTO)
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false }),
      ])
      setCategorias(cats)
      if (prodRes.error) throw prodRes.error
      setLista((prodRes.data ?? []).map((r) => mapProdutoRow(r as Record<string, unknown>)))
    } catch (e) {
      console.error('[AbaProdutos]', e)
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível carregar os produtos. Verifique se a migration Compras CDE foi aplicada.',
      )
      setLista([])
    } finally {
      setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrirNovo = () => {
    setForm(formProdutoVazio())
    setFormAberto(true)
    setErro(null)
  }

  const abrirEditar = (row: ProdutoCdeRow) => {
    setForm(formProdutoFromRow(row))
    setFormAberto(true)
    setErro(null)
  }

  const salvar = async () => {
    const msg = validarFormProduto(form)
    if (msg) {
      setErro(msg)
      return
    }
    const cat = categorias.find((c) => c.id === form.categoria_id)
    if (!cat) {
      setErro('Categoria inválida.')
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      const sub = await resolverOuCriarSubcategoria(supabase, form.categoria_id, form.subcategoria)
      const marca = await resolverOuCriarMarca(supabase, form.marca)
      const precoUsd = Number(form.preco_usd.replace(',', '.'))
      const pct = form.lancarOferta ? Number(form.percentual_desconto.replace(',', '.')) : 0
      let site = form.site_url.trim()
      if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`

      const palavras = montarPalavrasChave({
        nome: form.nome.trim(),
        categoriaNome: cat.nome,
        subcategoriaNome: sub.nome,
        marcaNome: marca.nome,
      })

      if (form.id) {
        let fotos = [...form.fotosExistentes]
        if (form.fotosNovas.length) {
          const novas = await uploadFotosProduto(supabase, empresaId, form.id, form.fotosNovas)
          fotos = [...fotos, ...novas]
        }
        const { error } = await supabase
          .from('produtos')
          .update({
            nome: form.nome.trim(),
            descricao: form.descricao.trim() || null,
            preco_usd: precoUsd,
            percentual_desconto: pct,
            fotos,
            foto_url: fotos[0] ?? null,
            site_url: site || null,
            categoria_id: form.categoria_id,
            subcategoria_id: sub.id,
            marca_id: marca.id,
            categoria_drena: cat.slug,
            marca: marca.nome,
            palavras_chave: palavras,
            ativo: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', form.id)
          .eq('empresa_id', empresaId)
        if (error) throw error
      } else {
        const { data: novo, error: errIns } = await supabase
          .from('produtos')
          .insert({
            empresa_id: empresaId,
            nome: form.nome.trim(),
            descricao: form.descricao.trim() || null,
            preco_usd: precoUsd,
            percentual_desconto: pct,
            fotos: [],
            site_url: site || null,
            categoria_id: form.categoria_id,
            subcategoria_id: sub.id,
            marca_id: marca.id,
            categoria_drena: cat.slug,
            marca: marca.nome,
            palavras_chave: palavras,
            ativo: true,
          })
          .select('id')
          .single()
        if (errIns) throw errIns
        const novoId = String(novo.id)
        const fotos = await uploadFotosProduto(supabase, empresaId, novoId, form.fotosNovas)
        const { error: errUp } = await supabase
          .from('produtos')
          .update({
            fotos,
            foto_url: fotos[0] ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', novoId)
        if (errUp) throw errUp
      }

      setFormAberto(false)
      setForm(formProdutoVazio())
      await carregar()
    } catch (e) {
      console.error('[AbaProdutos] salvar', e)
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o produto.')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (id: string) => {
    if (!window.confirm('Excluir este produto do catálogo?')) return
    setExcluindoId(id)
    setErro(null)
    try {
      const { error } = await supabase.from('produtos').delete().eq('id', id).eq('empresa_id', empresaId)
      if (error) throw error
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.')
    } finally {
      setExcluindoId(null)
    }
  }

  if (carregando) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando produtos…</p>
  }

  return (
    <div className="space-y-4">
      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>
      ) : null}

      {formAberto ? (
        <FormProduto
          form={form}
          categorias={categorias}
          onChange={setForm}
          onSalvar={() => void salvar()}
          onCancelar={() => {
            setFormAberto(false)
            setForm(formProdutoVazio())
            setErro(null)
          }}
          salvando={salvando}
          titulo={form.id ? 'Editar produto' : 'Cadastrar produto'}
        />
      ) : (
        <button
          type="button"
          onClick={abrirNovo}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
          style={{ backgroundColor: COR_AZUL_LOGO }}
        >
          <CirclePlus className="h-5 w-5" aria-hidden />
          + CADASTRAR
        </button>
      )}

      {!formAberto ? (
        lista.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Nenhum produto cadastrado.</p>
        ) : (
          <ul className="space-y-3">
            {lista.map((item) => (
              <li key={item.id}>
                <MiniCardProdutoConfig
                  item={item}
                  onEditar={() => abrirEditar(item)}
                  onExcluir={() => void excluir(item.id)}
                  excluindo={excluindoId === item.id}
                />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}
