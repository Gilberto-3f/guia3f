'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CirclePlus, Pencil, Send, Wrench } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFotosServicoLocal } from '@/lib/servicosLocaisFotos'
import {
  COR_AZUL_LOGO,
  SELECT_SERVICO_LOCAL,
  mapServicoLocalRow,
  type ServicoLocalRow,
} from '@/lib/servicosLocaisCatalogo'
import { resolverOuCriarCategoriaServicoLocal } from '@/lib/servicosLocaisTaxonomia'
import { publicarServicosLocaisFeed, snapshotServicosParaFeed } from '@/lib/publicarServicosLocaisFeed'
import { carregarCotacoesMap, type CotacaoMap } from '@/lib/comprasCdeHub'
import {
  moedaPadraoParaUsd,
  normalizarMoedaPadrao,
  type MoedaPadraoLoja,
} from '@/lib/comprasCdeMoedaPadrao'
import { normalizarErroCadastroEmpresa, indiceFotoRejeitada } from '@/lib/mensagensCadastroEmpresa'
import ChevronPasta from '../hospedagem/ChevronPasta'
import FormServico, {
  formServicoFromRow,
  formServicoVazio,
  validarFormServico,
  type FormServicoState,
} from './FormServico'
import MiniCardServicoConfig from './MiniCardServicoConfig'

type Props = {
  empresaId: string
}

type SecaoCategoria = {
  categoriaId: string
  categoriaNome: string
  servicos: ServicoLocalRow[]
}

export default function AbaServicos({ empresaId }: Props) {
  const [lista, setLista] = useState<ServicoLocalRow[]>([])
  const [pendentes, setPendentes] = useState<ServicoLocalRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormServicoState>(formServicoVazio())
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
  const [moedaPadrao, setMoedaPadrao] = useState<MoedaPadraoLoja>('USD')
  const [cotacoes, setCotacoes] = useState<CotacaoMap>({
    USD: 0.2,
    EUR: 0.18,
    ARS: 180,
    PYG: 1500,
  })

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    setErro(null)
    try {
      const [pubRes, penRes, empRes, cotMap] = await Promise.all([
        supabase
          .from('servicos_locais_itens')
          .select(SELECT_SERVICO_LOCAL)
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('servicos_locais_itens')
          .select(SELECT_SERVICO_LOCAL)
          .eq('empresa_id', empresaId)
          .eq('ativo', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('empresas')
          .select('usuario_id, nome_usuario, moeda_padrao')
          .eq('id', empresaId)
          .maybeSingle(),
        carregarCotacoesMap(supabase),
      ])
      setCotacoes(cotMap)
      if (pubRes.error) throw pubRes.error
      if (penRes.error) throw penRes.error
      setLista((pubRes.data ?? []).map((r) => mapServicoLocalRow(r as Record<string, unknown>)))
      setPendentes((penRes.data ?? []).map((r) => mapServicoLocalRow(r as Record<string, unknown>)))
      setEmpresaMeta({
        usuario_id: empRes.data?.usuario_id != null ? String(empRes.data.usuario_id) : null,
        nome_usuario: empRes.data?.nome_usuario != null ? String(empRes.data.nome_usuario) : null,
      })
      setMoedaPadrao(normalizarMoedaPadrao(empRes.data?.moeda_padrao))
    } catch (e) {
      console.error('[AbaServicos]', e)
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível carregar os serviços. Verifique se a migration foi aplicada.',
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
          servicos: [],
        })
      }
      map.get(key)!.servicos.push(p)
    }
    return [...map.values()].sort(
      (a, b) =>
        b.servicos.length - a.servicos.length || a.categoriaNome.localeCompare(b.categoriaNome),
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
    setForm(formServicoVazio())
    setFormAberto(true)
    setErro(null)
  }

  const abrirEditar = (row: ServicoLocalRow) => {
    setForm(formServicoFromRow(row, moedaPadrao, cotacoes))
    setFormAberto(true)
    setErro(null)
  }

  const salvar = async () => {
    const msg = validarFormServico(form)
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
      const cat = await resolverOuCriarCategoriaServicoLocal(supabase, empresaId, form.categoria)
      const valorDigitado = Number(form.preco_usd.replace(',', '.'))
      const precoUsd = moedaPadraoParaUsd(valorDigitado, moedaPadrao, cotacoes)
      if (!Number.isFinite(precoUsd) || precoUsd <= 0) {
        throw new Error('Não foi possível converter o valor para dólar. Verifique as cotações.')
      }
      const pct = form.lancarOferta ? Number(form.percentual_desconto.replace(',', '.')) : 0
      let site = form.site_url.trim()
      if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`

      if (form.id) {
        let fotos = [...form.fotosExistentes]
        if (form.fotosNovas.length) {
          const novas = await uploadFotosServicoLocal(supabase, empresaId, form.id, form.fotosNovas)
          if (novas.length !== form.fotosNovas.length) {
            throw new Error('Uma ou mais fotos não foram aceitas. Corrija e salve novamente.')
          }
          fotos = [...fotos, ...novas]
        }
        if (fotos.length < 1) throw new Error('Envie no mínimo 1 foto.')
        const { error } = await supabase
          .from('servicos_locais_itens')
          .update({
            nome: form.nome.trim(),
            descricao: form.descricao.trim() || null,
            preco_usd: precoUsd,
            percentual_desconto: pct,
            fotos,
            foto_url: fotos[0] ?? null,
            site_url: site || null,
            categoria_id: cat.id,
            ativo: !editandoPendente,
            updated_at: new Date().toISOString(),
          })
          .eq('id', form.id)
          .eq('empresa_id', empresaId)
        if (error) throw error
      } else {
        const { data: novo, error: errIns } = await supabase
          .from('servicos_locais_itens')
          .insert({
            empresa_id: empresaId,
            nome: form.nome.trim(),
            descricao: form.descricao.trim() || null,
            preco_usd: precoUsd,
            percentual_desconto: pct,
            fotos: [],
            site_url: site || null,
            categoria_id: cat.id,
            ativo: false,
          })
          .select('id')
          .single()
        if (errIns) throw errIns
        const novoId = String(novo.id)
        rascunhoId = novoId

        const fotos = await uploadFotosServicoLocal(supabase, empresaId, novoId, form.fotosNovas)

        if (!fotos.length || fotos.length < form.fotosNovas.length) {
          throw new Error('Uma ou mais fotos não foram aceitas. Corrija e salve novamente.')
        }

        const { error: errUp } = await supabase
          .from('servicos_locais_itens')
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
      setForm(formServicoVazio())
      await carregar()
      if (eraNovo) {
        setModoEdicao(true)
        setMsgCadastro(null)
      }
    } catch (e) {
      console.error('[AbaServicos] salvar', e)
      if (rascunhoId) {
        await supabase.from('servicos_locais_itens').delete().eq('id', rascunhoId).eq('empresa_id', empresaId)
        rascunhoId = null
      }
      setFotoRejeitadaIndice(indiceFotoRejeitada(e))
      setErro(normalizarErroCadastroEmpresa(e, 'Não foi possível salvar o serviço.'))
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (id: string) => {
    if (!window.confirm('Excluir este serviço?')) return
    setExcluindoId(id)
    setErro(null)
    try {
      const { error } = await supabase
        .from('servicos_locais_itens')
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
        const snaps = snapshotServicosParaFeed(pendentes)
        const res = await publicarServicosLocaisFeed(supabase, {
          empresaId,
          autorId: empresaMeta.usuario_id,
          username: empresaMeta.nome_usuario ?? '',
          servicoIds: ids,
          snapshots: snaps,
        })
        if (!res.ok) throw new Error(res.error)
        const n = ids.length
        setMsgCadastro(
          n === 1
            ? 'Você cadastrou 1 novo serviço (já publicado na lista e no feed).'
            : `Você cadastrou ${n} novos serviços (já publicados na lista e no feed).`,
        )
        setModoEdicao(false)
        setFormAberto(false)
        await carregar()
        window.setTimeout(() => setMsgCadastro(null), 6000)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível publicar os serviços.')
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
        ? 'Você cadastrou 1 novo serviço (eles serão mostrados quando você atualizar a lista).'
        : `Você cadastrou ${n} novos serviços (eles serão mostrados quando você atualizar a lista).`,
    )
  }, [temPendentes, pendentes.length])

  if (carregando) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando serviços…</p>
  }

  return (
    <div className="space-y-4">
      {!formAberto && erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>
      ) : null}

      {formAberto ? (
        <FormServico
          form={form}
          onChange={setForm}
          onSalvar={() => void salvar()}
          onCancelar={() => {
            setFormAberto(false)
            setForm(formServicoVazio())
            setErro(null)
            setFotoRejeitadaIndice(null)
          }}
          salvando={salvando}
          titulo={form.id ? 'Editar servico' : 'Cadastrar servico'}
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
                EDITAR SERVIÇOS
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
                    <MiniCardServicoConfig
                      item={item}
                      onEditar={() => abrirEditar(item)}
                      onExcluir={() => void excluir(item.id)}
                      excluindo={excluindoId === item.id}
                      moedaPadrao={moedaPadrao}
                      cotacoes={cotacoes}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {lista.length === 0 && pendentes.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Nenhum servico cadastrado.</p>
          ) : lista.length === 0 ? null : (
            <div className="space-y-3">
              {secoes.map((sec) => (
                <ChevronPasta
                  key={sec.categoriaId}
                  titulo={`${sec.categoriaNome} • ${sec.servicos.length}`}
                  icone={Wrench}
                  corTitulo={COR_AZUL_LOGO}
                  aberto={Boolean(abertos[sec.categoriaId])}
                  onToggle={() =>
                    setAbertos((a) => ({ ...a, [sec.categoriaId]: !a[sec.categoriaId] }))
                  }
                >
                  <ul className="space-y-3">
                    {sec.servicos.map((item) => (
                      <li key={item.id}>
                        <MiniCardServicoConfig
                          item={item}
                          onEditar={() => {
                            setModoEdicao(true)
                            abrirEditar(item)
                          }}
                          onExcluir={() => void excluir(item.id)}
                          excluindo={excluindoId === item.id}
                          moedaPadrao={moedaPadrao}
                          cotacoes={cotacoes}
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
