'use client'

import { useCallback, useEffect, useState } from 'react'
import { CirclePlus, Pencil, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFotosAcomodacao } from '@/lib/hospedagemAcomodacaoFotos'
import {
  COR_AZUL_LOGO,
  mapAcomodacaoRow,
  tipoCategoriaImovel,
  type HospedagemAcomodacaoRow,
} from '@/lib/hospedagemAcomodacoesCatalogo'
import { publicarAcomodacoesFeed, snapshotAcomodacoesParaFeed } from '@/lib/publicarAcomodacoesFeed'
import { normalizarErroCadastroEmpresa, indiceFotoRejeitada } from '@/lib/mensagensCadastroEmpresa'
import FormAcomodacao, {
  formAcomodacaoVazio,
  formFromRow,
  validarFormAcomodacao,
  type FormAcomodacaoState,
} from './FormAcomodacao'
import MiniCardAcomodacao from './MiniCardAcomodacao'

type Props = {
  empresaId: string
}

export default function AbaAcomodacoes({ empresaId }: Props) {
  const [lista, setLista] = useState<HospedagemAcomodacaoRow[]>([])
  const [pendentes, setPendentes] = useState<HospedagemAcomodacaoRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormAcomodacaoState>(formAcomodacaoVazio())
  const [salvando, setSalvando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [fotoRejeitadaIndice, setFotoRejeitadaIndice] = useState<number | null>(null)
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
      const [pubRes, penRes, empRes] = await Promise.all([
        supabase
          .from('hospedagem_acomodacoes')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('hospedagem_acomodacoes')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('ativo', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('empresas')
          .select('usuario_id, nome_usuario')
          .eq('id', empresaId)
          .maybeSingle(),
      ])
      if (pubRes.error) throw pubRes.error
      if (penRes.error) throw penRes.error
      setLista((pubRes.data ?? []).map((r) => mapAcomodacaoRow(r as Record<string, unknown>)))
      setPendentes((penRes.data ?? []).map((r) => mapAcomodacaoRow(r as Record<string, unknown>)))
      setEmpresaMeta({
        usuario_id: empRes.data?.usuario_id != null ? String(empRes.data.usuario_id) : null,
        nome_usuario: empRes.data?.nome_usuario != null ? String(empRes.data.nome_usuario) : null,
      })
    } catch (e) {
      console.error('[AbaAcomodacoes]', e)
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível carregar as acomodações. Verifique se a migration foi aplicada.',
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

  const temPendentes = pendentes.length > 0
  const botaoPrincipalPublicar = temPendentes
  const mostrarResumo = !modoEdicao && !temPendentes && !formAberto && lista.length > 0

  const abrirNovo = () => {
    setForm(formAcomodacaoVazio())
    setFormAberto(true)
    setErro(null)
  }

  const abrirEditar = (row: HospedagemAcomodacaoRow) => {
    setForm(formFromRow(row))
    setFormAberto(true)
    setErro(null)
  }

  const salvar = async () => {
    const msg = validarFormAcomodacao(form)
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
      const tipo = tipoCategoriaImovel(form.categoria_imovel)
      const capacidade = Math.max(1, Math.floor(Number(form.capacidade_pessoas)))
      const valor = Number(form.valor_diaria)
      let site = form.site_url.trim()
      if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`

      const payloadBase = {
        categoria_imovel: form.categoria_imovel,
        categoria_particular: tipo === 'particular' ? form.categoria_particular : null,
        opcao_compartilhada: tipo === 'compartilhado' ? form.opcao_compartilhada : null,
        capacidade_pessoas: capacidade,
        valor_diaria: valor,
        comodidades_padrao: form.comodidades_padrao,
        comodidades_extras: form.comodidades_extras,
        site_url: site || null,
      }

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
            ...payloadBase,
            fotos,
            ativo: !editandoPendente,
          })
          .eq('id', form.id)
          .eq('empresa_id', empresaId)
        if (error) throw error
      } else {
        const { data: criada, error: insErr } = await supabase
          .from('hospedagem_acomodacoes')
          .insert({
            empresa_id: empresaId,
            ...payloadBase,
            fotos: [],
            ativo: false,
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        const novoId = String(criada.id)
        rascunhoId = novoId

        const fotosUpload = await uploadFotosAcomodacao(supabase, empresaId, novoId, form.fotosNovas)

        if (fotosUpload.length < 2) {
          throw new Error('Envie no mínimo 2 fotos da acomodação.')
        }
        const fotos = fotosUpload.length > 5 ? fotosUpload.slice(0, 5) : fotosUpload

        const { error: upErr } = await supabase
          .from('hospedagem_acomodacoes')
          .update({ fotos, ativo: false })
          .eq('id', novoId)
          .eq('empresa_id', empresaId)
        if (upErr) throw upErr
        rascunhoId = null
      }

      setFormAberto(false)
      setForm(formAcomodacaoVazio())
      await carregar()
      if (eraNovo) {
        setModoEdicao(true)
        setMsgCadastro(null)
      }
    } catch (e) {
      console.error('[AbaAcomodacoes] salvar', e)
      if (rascunhoId) {
        await supabase
          .from('hospedagem_acomodacoes')
          .delete()
          .eq('id', rascunhoId)
          .eq('empresa_id', empresaId)
        rascunhoId = null
      }
      setFotoRejeitadaIndice(indiceFotoRejeitada(e))
      setErro(normalizarErroCadastroEmpresa(e, 'Não foi possível salvar a acomodação.'))
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
        const snaps = snapshotAcomodacoesParaFeed(pendentes)
        const res = await publicarAcomodacoesFeed(supabase, {
          empresaId,
          autorId: empresaMeta.usuario_id,
          username: empresaMeta.nome_usuario ?? '',
          acomodacaoIds: ids,
          snapshots: snaps,
        })
        if (!res.ok) throw new Error(res.error)
        const n = ids.length
        setMsgCadastro(
          n === 1
            ? 'Você cadastrou 1 nova acomodação (já publicada na lista e no feed).'
            : `Você cadastrou ${n} novas acomodações (já publicadas na lista e no feed).`,
        )
        setModoEdicao(false)
        setFormAberto(false)
        await carregar()
        window.setTimeout(() => setMsgCadastro(null), 6000)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível publicar as acomodações.')
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
        ? 'Você cadastrou 1 nova acomodação (ela será mostrada quando você atualizar a lista).'
        : `Você cadastrou ${n} novas acomodações (elas serão mostradas quando você atualizar a lista).`,
    )
  }, [temPendentes, pendentes.length])

  if (carregando) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando acomodações…</p>
  }

  return (
    <div className="space-y-4">
      {!formAberto && erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>
      ) : null}

      {formAberto ? (
        <FormAcomodacao
          form={form}
          onChange={setForm}
          onSalvar={() => void salvar()}
          onCancelar={() => {
            setFormAberto(false)
            setForm(formAcomodacaoVazio())
            setErro(null)
            setFotoRejeitadaIndice(null)
          }}
          salvando={salvando}
          titulo={form.id ? 'Editar acomodação' : 'Cadastrar acomodação'}
          erro={erro}
          fotoRejeitadaIndice={fotoRejeitadaIndice}
          onFotoRejeitadaIndiceChange={(i) => {
            setFotoRejeitadaIndice(i)
            if (i == null) setErro(null)
          }}
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
                EDITAR ACOMODAÇÕES
              </>
            )}
          </button>

          {mostrarResumo ? (
            <p className="text-center text-sm font-medium text-gray-600">
              {lista.length} {lista.length === 1 ? 'acomodação cadastrada' : 'acomodações cadastradas'}
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
                Recém cadastradas (aguardando publicação)
              </p>
              <ul className="space-y-3">
                {pendentes.map((item) => (
                  <li key={item.id}>
                    <MiniCardAcomodacao
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
            <p className="py-6 text-center text-sm text-gray-500">Nenhuma acomodação cadastrada.</p>
          ) : lista.length === 0 ? null : (
            <ul className="space-y-3">
              {lista.map((item) => (
                <li key={item.id}>
                  <MiniCardAcomodacao
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
          )}
        </>
      )}
    </div>
  )
}
