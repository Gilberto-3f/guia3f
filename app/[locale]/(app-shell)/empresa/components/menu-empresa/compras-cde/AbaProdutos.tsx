'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CirclePlus, Pencil, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFotosProduto } from '@/lib/comprasCdeFotos'
import {
  COR_AZUL_LOGO,
  mapProdutoRow,
  type ProdutoCategoriaRow,
  type ProdutoCdeRow,
} from '@/lib/comprasCdeCatalogo'
import { sanitizarPalavrasChave } from '@/lib/palavrasChaveGuia'
import { iconeCategoriaProduto } from '@/lib/comprasCdeCategoriaIcone'
import {
  listarCategoriasProduto,
  resolverOuCriarMarca,
  resolverOuCriarSubcategoria,
} from '@/lib/comprasCdeTaxonomia'
import {
  publicarCatalogoProdutosFeed,
  snapshotProdutosParaFeed,
} from '@/lib/publicarCatalogoProdutosFeed'
import ChevronPasta from '../hospedagem/ChevronPasta'
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

type SecaoCategoria = {
  categoriaId: string
  categoriaNome: string
  categoriaSlug: string | null
  ordem: number
  produtos: ProdutoCdeRow[]
}

const SELECT_PRODUTO = `
  id, empresa_id, nome, descricao, preco_usd, percentual_desconto,
  fotos, foto_url, site_url, ativo, categoria_id, subcategoria_id, marca_id,
  palavras_chave, created_at,
  produto_categorias ( id, nome, ordem, slug ),
  produto_subcategorias ( nome ),
  produto_marcas ( nome )
`

export default function AbaProdutos({ empresaId }: Props) {
  const [lista, setLista] = useState<ProdutoCdeRow[]>([])
  const [pendentes, setPendentes] = useState<ProdutoCdeRow[]>([])
  const [categorias, setCategorias] = useState<ProdutoCategoriaRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormProdutoState>(formProdutoVazio())
  const [salvando, setSalvando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  /** Modo edição: mostra botão Cadastrar. */
  const [modoEdicao, setModoEdicao] = useState(false)
  const [msgCadastro, setMsgCadastro] = useState<string | null>(null)
  const [empresaMeta, setEmpresaMeta] = useState<{
    usuario_id: string | null
    nome_usuario: string | null
  }>({ usuario_id: null, nome_usuario: null })

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    setErro(null)
    try {
      const [cats, pubRes, penRes, empRes] = await Promise.all([
        listarCategoriasProduto(supabase),
        supabase
          .from('produtos')
          .select(SELECT_PRODUTO)
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('produtos')
          .select(SELECT_PRODUTO)
          .eq('empresa_id', empresaId)
          .eq('ativo', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('empresas')
          .select('usuario_id, nome_usuario')
          .eq('id', empresaId)
          .maybeSingle(),
      ])
      setCategorias(cats)
      if (pubRes.error) throw pubRes.error
      if (penRes.error) throw penRes.error
      setLista((pubRes.data ?? []).map((r) => mapProdutoRow(r as Record<string, unknown>)))
      setPendentes((penRes.data ?? []).map((r) => mapProdutoRow(r as Record<string, unknown>)))
      setEmpresaMeta({
        usuario_id: empRes.data?.usuario_id != null ? String(empRes.data.usuario_id) : null,
        nome_usuario: empRes.data?.nome_usuario != null ? String(empRes.data.nome_usuario) : null,
      })
    } catch (e) {
      console.error('[AbaProdutos]', e)
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível carregar os produtos. Verifique se a migration Compras CDE foi aplicada.',
      )
      setLista([])
      setPendentes([])
    } finally {
      setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /** Apenas categorias com produtos já publicados. */
  const secoes = useMemo((): SecaoCategoria[] => {
    const map = new Map<string, SecaoCategoria>()
    for (const p of lista) {
      const key = p.categoria_id ?? 'outros'
      if (!map.has(key)) {
        map.set(key, {
          categoriaId: key,
          categoriaNome: p.categoria_nome || 'Outros',
          categoriaSlug: p.categoria_slug ?? null,
          ordem: p.categoria_ordem ?? 999,
          produtos: [],
        })
      }
      map.get(key)!.produtos.push(p)
    }
    return [...map.values()].sort(
      (a, b) =>
        b.produtos.length - a.produtos.length ||
        a.ordem - b.ordem ||
        a.categoriaNome.localeCompare(b.categoriaNome),
    )
  }, [lista])

  useEffect(() => {
    setAbertos((prev) => {
      const next = { ...prev }
      for (const s of secoes) {
        if (next[s.categoriaId] === undefined) next[s.categoriaId] = false
      }
      return next
    })
  }, [secoes])

  const temPendentes = pendentes.length > 0
  const botaoPrincipalPublicar = temPendentes
  const totalCategoriasComProduto = secoes.length
  const mostrarResumoCatalogo = !modoEdicao && !temPendentes && !formAberto && lista.length > 0

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
    let rascunhoId: string | null = null
    const eraNovo = !form.id
    const editandoPendente = Boolean(form.id && pendentes.some((p) => p.id === form.id))

    try {
      const sub = await resolverOuCriarSubcategoria(supabase, form.categoria_id, form.subcategoria)
      const marca = await resolverOuCriarMarca(supabase, form.marca)
      const precoUsd = Number(form.preco_usd.replace(',', '.'))
      const pct = form.lancarOferta ? Number(form.percentual_desconto.replace(',', '.')) : 0
      let site = form.site_url.trim()
      if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`

      const palavras = sanitizarPalavrasChave(form.metatags)

      if (form.id) {
        let fotos = [...form.fotosExistentes]
        if (form.fotosNovas.length) {
          const novas = await uploadFotosProduto(supabase, empresaId, form.id, form.fotosNovas)
          if (novas.length !== form.fotosNovas.length) {
            throw new Error('Uma ou mais fotos não foram aceitas. Corrija e salve novamente.')
          }
          fotos = [...fotos, ...novas]
        }
        if (fotos.length < 1) {
          throw new Error('Envie no mínimo 1 foto.')
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
            // Pendente continua inativo; publicado permanece ativo.
            ativo: !editandoPendente,
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
            ativo: false,
          })
          .select('id')
          .single()
        if (errIns) throw errIns
        const novoId = String(novo.id)
        rascunhoId = novoId

        let fotos: string[]
        try {
          fotos = await uploadFotosProduto(supabase, empresaId, novoId, form.fotosNovas)
        } catch (upErr) {
          const motivo =
            upErr instanceof Error && upErr.message
              ? upErr.message
              : 'Foto não aceita. Troque a imagem e salve novamente.'
          throw new Error(motivo)
        }

        if (!fotos.length || fotos.length < form.fotosNovas.length) {
          throw new Error('Uma ou mais fotos não foram aceitas. Corrija e salve novamente.')
        }

        const { error: errUp } = await supabase
          .from('produtos')
          .update({
            fotos,
            foto_url: fotos[0] ?? null,
            ativo: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', novoId)
          .eq('empresa_id', empresaId)
        if (errUp) throw errUp
        rascunhoId = null
      }

      setFormAberto(false)
      setForm(formProdutoVazio())
      await carregar()
      if (eraNovo) {
        setModoEdicao(true)
        setMsgCadastro(null)
      }
    } catch (e) {
      console.error('[AbaProdutos] salvar', e)
      if (rascunhoId) {
        await supabase.from('produtos').delete().eq('id', rascunhoId).eq('empresa_id', empresaId)
        rascunhoId = null
      }
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

  const onBotaoPrincipal = async () => {
    if (botaoPrincipalPublicar) {
      if (!empresaMeta.usuario_id) {
        setErro('Não foi possível identificar o usuário da empresa para publicar no feed.')
        return
      }
      setPublicando(true)
      setErro(null)
      try {
        const ids = pendentes.map((p) => p.id)
        const snaps = snapshotProdutosParaFeed(pendentes)
        const res = await publicarCatalogoProdutosFeed(supabase, {
          empresaId,
          autorId: empresaMeta.usuario_id,
          username: empresaMeta.nome_usuario ?? '',
          produtoIds: ids,
          snapshots: snaps,
        })
        if (!res.ok) throw new Error(res.error)
        const n = ids.length
        setMsgCadastro(
          n === 1
            ? 'Você cadastrou 1 novo produto (já publicado no catálogo e no feed).'
            : `Você cadastrou ${n} novos produtos (já publicados no catálogo e no feed).`,
        )
        setModoEdicao(false)
        setFormAberto(false)
        await carregar()
        window.setTimeout(() => setMsgCadastro(null), 6000)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível publicar o catálogo.')
      } finally {
        setPublicando(false)
      }
      return
    }

    setModoEdicao(true)
    setMsgCadastro(null)
  }

  useEffect(() => {
    if (!temPendentes) return
    const n = pendentes.length
    setMsgCadastro(
      n === 1
        ? 'Você cadastrou 1 novo produto (eles serão mostrados quando você atualizar o catálogo).'
        : `Você cadastrou ${n} novos produtos (eles serão mostrados quando você atualizar o catálogo).`,
    )
  }, [temPendentes, pendentes.length])

  if (carregando) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando produtos…</p>
  }

  return (
    <div className="space-y-4">
      {!formAberto && erro ? (
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
          erro={erro}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => void onBotaoPrincipal()}
            disabled={publicando}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: COR_AZUL_LOGO }}
          >
            {botaoPrincipalPublicar ? (
              <>
                <Send className="h-5 w-5" aria-hidden />
                {publicando ? 'Publicando…' : 'PUBLICAR'}
              </>
            ) : (
              <>
                <Pencil className="h-5 w-5" aria-hidden />
                EDITAR CATÁLOGO
              </>
            )}
          </button>

          {mostrarResumoCatalogo ? (
            <p className="text-center text-sm font-medium text-gray-600">
              {lista.length} {lista.length === 1 ? 'Produto cadastrado' : 'Produtos cadastrados'}
              {' / '}
              {totalCategoriasComProduto}{' '}
              {totalCategoriasComProduto === 1 ? 'categoria' : 'categorias'}
            </p>
          ) : null}

          {modoEdicao || temPendentes ? (
            <button
              type="button"
              onClick={abrirNovo}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#0097b2]/40 bg-[#0097b2]/5 py-3 text-sm font-bold text-[#0097b2]"
            >
              <CirclePlus className="h-5 w-5" aria-hidden />
              + CADASTRAR
            </button>
          ) : null}

          {msgCadastro ? (
            <p className="rounded-lg bg-[#0097b2]/10 px-3 py-2 text-center text-sm font-medium text-[#001f3f]">
              {msgCadastro}
            </p>
          ) : null}

          {pendentes.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Recém cadastrados (aguardando publicação)
              </p>
              <ul className="space-y-3">
                {pendentes.map((item) => (
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
            </div>
          ) : null}

          {lista.length === 0 && pendentes.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Nenhum produto cadastrado.</p>
          ) : lista.length === 0 ? null : (
            <div className="space-y-3">
              {secoes.map((sec) => {
                const Icone = iconeCategoriaProduto(sec.categoriaSlug || sec.categoriaNome)
                return (
                  <ChevronPasta
                    key={sec.categoriaId}
                    titulo={`${sec.categoriaNome} (${sec.produtos.length})`}
                    icone={Icone}
                    corTitulo={COR_AZUL_LOGO}
                    aberto={Boolean(abertos[sec.categoriaId])}
                    onToggle={() =>
                      setAbertos((a) => ({ ...a, [sec.categoriaId]: !a[sec.categoriaId] }))
                    }
                  >
                    <ul className="space-y-3">
                      {sec.produtos.map((item) => (
                        <li key={item.id}>
                          <MiniCardProdutoConfig
                            item={item}
                            onEditar={() => {
                              setModoEdicao(true)
                              abrirEditar(item)
                            }}
                            onExcluir={() => void excluir(item.id)}
                            excluindo={excluindoId === item.id}
                          />
                        </li>
                      ))}
                    </ul>
                  </ChevronPasta>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
