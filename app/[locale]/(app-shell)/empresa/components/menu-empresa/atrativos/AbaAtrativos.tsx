'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CirclePlus, Pencil, Send, Ticket } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFotosAtrativo } from '@/lib/atrativosFotos'
import {
  COR_AZUL_LOGO,
  FOTOS_MAX,
  FOTOS_MIN,
  SELECT_ATRATO_EXPERIENCIA,
  mapExperienciaRow,
  type AtrativoExperienciaRow,
} from '@/lib/atrativosCatalogo'
import { resolverOuCriarCategoriaAtrativo } from '@/lib/atrativosTaxonomia'
import { publicarAtrativosFeed, snapshotAtrativosParaFeed } from '@/lib/publicarAtrativosFeed'
import { normalizarMoedaPadrao, type MoedaPadraoLoja } from '@/lib/comprasCdeMoedaPadrao'
import { normalizarErroCadastroEmpresa, indiceFotoRejeitada } from '@/lib/mensagensCadastroEmpresa'
import ChevronPasta from '../hospedagem/ChevronPasta'
import FormAtrativo, {
  formAtrativoVazio,
  formFromRow,
  validarFormAtrativo,
  type FormAtrativoState,
} from './FormAtrativo'
import MiniCardAtrativoConfig from './MiniCardAtrativoConfig'

type Props = {
  empresaId: string
}

type SecaoCategoria = {
  categoriaId: string
  categoriaNome: string
  atrativos: AtrativoExperienciaRow[]
}

export default function AbaAtrativos({ empresaId }: Props) {
  const [lista, setLista] = useState<AtrativoExperienciaRow[]>([])
  const [pendentes, setPendentes] = useState<AtrativoExperienciaRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormAtrativoState>(formAtrativoVazio())
  const [salvando, setSalvando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [fotoRejeitadaIndice, setFotoRejeitadaIndice] = useState<number | null>(null)
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [modoEdicao, setModoEdicao] = useState(false)
  const [msgCadastro, setMsgCadastro] = useState<string | null>(null)
  const [empresaMeta, setEmpresaMeta] = useState<{
    usuario_id: string | null
    nome_usuario: string | null
  }>({ usuario_id: null, nome_usuario: null })
  const [moedaPadrao, setMoedaPadrao] = useState<MoedaPadraoLoja>('BRL')

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    setErro(null)
    try {
      const [pubRes, penRes, empRes] = await Promise.all([
        supabase
          .from('atrativos_experiencias')
          .select(SELECT_ATRATO_EXPERIENCIA)
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('atrativos_experiencias')
          .select(SELECT_ATRATO_EXPERIENCIA)
          .eq('empresa_id', empresaId)
          .eq('ativo', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('empresas')
          .select('usuario_id, nome_usuario, moeda_padrao')
          .eq('id', empresaId)
          .maybeSingle(),
      ])
      if (pubRes.error) throw pubRes.error
      if (penRes.error) throw penRes.error
      setLista((pubRes.data ?? []).map((r) => mapExperienciaRow(r as Record<string, unknown>)))
      setPendentes((penRes.data ?? []).map((r) => mapExperienciaRow(r as Record<string, unknown>)))
      setEmpresaMeta({
        usuario_id: empRes.data?.usuario_id != null ? String(empRes.data.usuario_id) : null,
        nome_usuario: empRes.data?.nome_usuario != null ? String(empRes.data.nome_usuario) : null,
      })
      setMoedaPadrao(normalizarMoedaPadrao(empRes.data?.moeda_padrao ?? 'BRL'))
    } catch (e) {
      console.error('[AbaAtrativos]', e)
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível carregar os atrativos. Verifique se a migration foi aplicada.',
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

  const secoes = useMemo((): SecaoCategoria[] => {
    const map = new Map<string, SecaoCategoria>()
    for (const p of lista) {
      const key = p.categoria_id ?? 'outros'
      if (!map.has(key)) {
        map.set(key, {
          categoriaId: key,
          categoriaNome: p.categoria_nome || 'Outros',
          atrativos: [],
        })
      }
      map.get(key)!.atrativos.push(p)
    }
    return [...map.values()].sort(
      (a, b) =>
        b.atrativos.length - a.atrativos.length || a.categoriaNome.localeCompare(b.categoriaNome),
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
  const totalCategorias = secoes.length
  const mostrarResumo = !modoEdicao && !temPendentes && !formAberto && lista.length > 0

  const abrirNovo = () => {
    setForm(formAtrativoVazio())
    setFormAberto(true)
    setErro(null)
  }

  const abrirEditar = (row: AtrativoExperienciaRow) => {
    setForm(formFromRow(row))
    setFormAberto(true)
    setErro(null)
  }

  const salvar = async () => {
    const msg = validarFormAtrativo(form)
    if (msg) {
      setFotoRejeitadaIndice(null)
      setErro(msg)
      return
    }

    setSalvando(true)
    setErro(null)
    setFotoRejeitadaIndice(null)
    let rascunhoId: string | null = null
    const eraNovo = !form.id
    const editandoPendente = Boolean(form.id && pendentes.some((p) => p.id === form.id))

    try {
      const cat = await resolverOuCriarCategoriaAtrativo(supabase, empresaId, form.categoria)
      let site = form.site_url.trim()
      if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`

      const payloadBase = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        oferece_inteira: form.oferece_inteira,
        preco_inteira: form.oferece_inteira
          ? Number(String(form.preco_inteira).replace(',', '.'))
          : null,
        oferece_meia: form.oferece_meia,
        preco_meia: form.oferece_meia
          ? Number(String(form.preco_meia).replace(',', '.'))
          : null,
        site_url: site || null,
        categoria_id: cat.id,
      }

      if (form.id) {
        let fotos = [...form.fotosExistentes]
        if (form.fotosNovas.length) {
          const novas = await uploadFotosAtrativo(supabase, empresaId, form.id, form.fotosNovas)
          fotos = [...fotos, ...novas]
        }
        if (fotos.length < FOTOS_MIN || fotos.length > FOTOS_MAX) {
          throw new Error(`O atrativo precisa ter entre ${FOTOS_MIN} e ${FOTOS_MAX} fotos.`)
        }
        const { error } = await supabase
          .from('atrativos_experiencias')
          .update({
            ...payloadBase,
            fotos,
            ativo: !editandoPendente,
          })
          .eq('id', form.id)
          .eq('empresa_id', empresaId)
        if (error) throw error
      } else {
        const { data: novo, error: errIns } = await supabase
          .from('atrativos_experiencias')
          .insert({
            empresa_id: empresaId,
            ...payloadBase,
            fotos: [],
            ativo: false,
          })
          .select('id')
          .single()
        if (errIns) throw errIns
        const novoId = String(novo.id)
        rascunhoId = novoId

        const fotos = await uploadFotosAtrativo(supabase, empresaId, novoId, form.fotosNovas)

        if (!fotos.length || fotos.length < form.fotosNovas.length) {
          throw new Error('Uma ou mais fotos não foram aceitas. Corrija e salve novamente.')
        }
        if (fotos.length > FOTOS_MAX) fotos = fotos.slice(0, FOTOS_MAX)

        const { error: errUp } = await supabase
          .from('atrativos_experiencias')
          .update({ fotos, ativo: false })
          .eq('id', novoId)
          .eq('empresa_id', empresaId)
        if (errUp) throw errUp
        rascunhoId = null
      }

      setFormAberto(false)
      setForm(formAtrativoVazio())
      await carregar()
      if (eraNovo) {
        setModoEdicao(true)
        setMsgCadastro(null)
      }
    } catch (e) {
      console.error('[AbaAtrativos] salvar', e)
      if (rascunhoId) {
        await supabase
          .from('atrativos_experiencias')
          .delete()
          .eq('id', rascunhoId)
          .eq('empresa_id', empresaId)
        rascunhoId = null
      }
      setFotoRejeitadaIndice(indiceFotoRejeitada(e))
      setErro(normalizarErroCadastroEmpresa(e, 'Não foi possível salvar o atrativo.'))
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
        const snaps = snapshotAtrativosParaFeed(pendentes)
        const res = await publicarAtrativosFeed(supabase, {
          empresaId,
          autorId: empresaMeta.usuario_id,
          username: empresaMeta.nome_usuario ?? '',
          atrativoIds: ids,
          snapshots: snaps,
        })
        if (!res.ok) throw new Error(res.error)
        const n = ids.length
        setMsgCadastro(
          n === 1
            ? 'Você cadastrou 1 novo atrativo (já publicado na lista e no feed).'
            : `Você cadastrou ${n} novos atrativos (já publicados na lista e no feed).`,
        )
        setModoEdicao(false)
        setFormAberto(false)
        await carregar()
        window.setTimeout(() => setMsgCadastro(null), 6000)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível publicar os atrativos.')
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
        ? 'Você cadastrou 1 novo atrativo (eles serão mostrados quando você atualizar a lista).'
        : `Você cadastrou ${n} novos atrativos (eles serão mostrados quando você atualizar a lista).`,
    )
  }, [temPendentes, pendentes.length])

  if (carregando) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando atrativos…</p>
  }

  return (
    <div className="space-y-4">
      {!formAberto && erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>
      ) : null}

      {formAberto ? (
        <FormAtrativo
          form={form}
          onChange={setForm}
          onSalvar={() => void salvar()}
          onCancelar={() => {
            setFormAberto(false)
            setForm(formAtrativoVazio())
            setErro(null)
            setFotoRejeitadaIndice(null)
          }}
          salvando={salvando}
          titulo={form.id ? 'Editar atrativo' : 'Cadastrar atrativo'}
          erro={erro}
          fotoRejeitadaIndice={fotoRejeitadaIndice}
          onFotoRejeitadaIndiceChange={(i) => {
            setFotoRejeitadaIndice(i)
            if (i == null) setErro(null)
          }}
          moedaPadrao={moedaPadrao}
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
                EDITAR ATRATIVOS
              </>
            )}
          </button>

          {mostrarResumo ? (
            <p className="text-center text-sm font-medium text-gray-600">
              {lista.length} {lista.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
              {' / '}
              {totalCategorias} {totalCategorias === 1 ? 'categoria' : 'categorias'}
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
                    <MiniCardAtrativoConfig
                      item={item}
                      onEditar={() => abrirEditar(item)}
                      onExcluir={() => void excluir(item.id)}
                      excluindo={excluindoId === item.id}
                      moedaPadrao={moedaPadrao}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {lista.length === 0 && pendentes.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Nenhum atrativo cadastrado.</p>
          ) : lista.length === 0 ? null : (
            <div className="space-y-3">
              {secoes.map((sec) => (
                <ChevronPasta
                  key={sec.categoriaId}
                  titulo={`${sec.categoriaNome} • ${sec.atrativos.length}`}
                  icone={Ticket}
                  corTitulo={COR_AZUL_LOGO}
                  aberto={Boolean(abertos[sec.categoriaId])}
                  onToggle={() =>
                    setAbertos((a) => ({ ...a, [sec.categoriaId]: !a[sec.categoriaId] }))
                  }
                >
                  <ul className="space-y-3">
                    {sec.atrativos.map((item) => (
                      <li key={item.id}>
                        <MiniCardAtrativoConfig
                          item={item}
                          onEditar={() => {
                            setModoEdicao(true)
                            abrirEditar(item)
                          }}
                          onExcluir={() => void excluir(item.id)}
                          excluindo={excluindoId === item.id}
                          moedaPadrao={moedaPadrao}
                        />
                      </li>
                    ))}
                  </ul>
                </ChevronPasta>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
