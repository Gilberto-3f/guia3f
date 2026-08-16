'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Star, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import AvatarImage from '@/components/AvatarImage'
import NomeComVerificacao from '@/components/NomeComVerificacao'

/**
 * @typedef {{ id: string; nota: number; feedback: string | null; resposta: string | null; created_at: string; nome: string; username: string; fotoUrl: string | null; categoria: string | null }} LinhaAvaliacao
 */

/** @param {string | null | undefined} s */
function fotoPerfil(s) {
  const raw = s != null ? String(s).trim() : ''
  return raw || null
}

/** @param {string} data */
function formatarDataAvaliacao(data) {
  const dt = new Date(data)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   profileId: string
 *   perfilTipo: 'turista' | 'profissional'
 *   profissionalId?: string | null
 *   abaInicial?: 'empresa' | 'profissional' | 'feedback'
 * }} props
 */
export default function PopupAvaliacoes({
  aberto,
  onFechar,
  profileId,
  perfilTipo,
  profissionalId = null,
  abaInicial = 'empresa',
}) {
  useModalScrollLock(aberto)
  const [aba, setAba] = useState(/** @type {'empresa' | 'profissional' | 'feedback'} */ (abaInicial))
  const [listaEmpresas, setListaEmpresas] = useState(/** @type {LinhaAvaliacao[]} */ ([]))
  const [listaProfissionais, setListaProfissionais] = useState(/** @type {LinhaAvaliacao[]} */ ([]))
  const [carregando, setCarregando] = useState(false)
  const carregamentoIdRef = useRef(0)

  const carregar = useCallback(async () => {
    const carregamentoId = ++carregamentoIdRef.current
    setCarregando(true)

    const carregarEmpresas = async () => {
      const { data: avEmp, error: errEmp } = await supabase
        .from('avaliacoes')
        .select('id, nota, feedback, created_at, alvo_id, alvo_tipo')
        .eq('usuario_id', profileId)
        .eq('alvo_tipo', 'empresa')
        .order('created_at', { ascending: false })

      if (errEmp) console.error('[PopupAvaliacoes] avaliacoes empresa:', errEmp.message)

      const rowsEmp = avEmp ?? []
      const empresaIds = [...new Set(rowsEmp.map((r) => String(r.alvo_id)).filter(Boolean))]
      /** @type {Map<string, { nome_fantasia: string; nome_usuario: string; foto_url: string | null; categoria: string | null }>} */
      const porEmpresaId = new Map()

      if (empresaIds.length) {
        const { data: emps, error: eErr } = await supabase
          .from('empresas')
          .select('id, nome_fantasia, nome_usuario, foto_url, categoria')
          .in('id', empresaIds)
        if (eErr) console.error('[PopupAvaliacoes] empresas:', eErr.message)
        for (const e of emps ?? []) {
          porEmpresaId.set(String(e.id), {
            nome_fantasia: String(e.nome_fantasia ?? 'Empresa'),
            nome_usuario: String(e.nome_usuario ?? ''),
            foto_url: e.foto_url != null ? String(e.foto_url) : null,
            categoria: e.categoria != null ? String(e.categoria) : null,
          })
        }
      }

      return rowsEmp.map((r) => {
        const emp = porEmpresaId.get(String(r.alvo_id))
        return {
          id: String(r.id),
          nota: Number(r.nota) || 0,
          feedback: r.feedback != null ? String(r.feedback) : null,
          created_at: String(r.created_at ?? ''),
          nome: emp?.nome_fantasia ?? '—',
          username: emp?.nome_usuario ?? '',
          fotoUrl: emp?.foto_url ?? null,
          categoria: emp?.categoria ?? null,
          resposta: null,
        }
      })
    }

    const carregarProfissionais = async () => {
      const perfilProfissional = perfilTipo === 'profissional'
      let profTargetIds = [profileId]

      if (perfilProfissional && profissionalId) {
        profTargetIds = [...new Set([profileId, String(profissionalId)].filter(Boolean))]
      } else if (perfilProfissional) {
        const { data: profProprio, error: profProprioErr } = await supabase
          .from('profissionais')
          .select('id')
          .eq('usuario_id', profileId)
          .maybeSingle()
        if (profProprioErr) {
          console.error('[PopupAvaliacoes] profissional próprio:', profProprioErr.message)
        }
        if (profProprio?.id) {
          profTargetIds = [...new Set([profileId, String(profProprio.id)].filter(Boolean))]
        }
      }

      const queryProf = supabase
        .from('avaliacoes')
        .select('id, nota, feedback, created_at, usuario_id, alvo_id, alvo_tipo, avaliador_tipo')
        .eq('alvo_tipo', 'profissional')
        .order('created_at', { ascending: false })

      const { data: avProf, error: errProf } = perfilProfissional
        ? await queryProf.in('alvo_id', profTargetIds).eq('avaliador_tipo', 'turista')
        : await queryProf.eq('usuario_id', profileId)

      if (errProf) {
        console.error('[PopupAvaliacoes] avaliacoes/feedback profissional:', errProf.message)
      }

      const rowsProf = avProf ?? []
      const profIds = [
        ...new Set(
          rowsProf
            .map((r) => String(perfilProfissional ? r.usuario_id : r.alvo_id))
            .filter(Boolean),
        ),
      ]
      /** @type {Map<string, { nome: string; username: string; fotoUrl: string | null }>} */
      const porProfId = new Map()

      if (profIds.length && perfilProfissional) {
        const { data: perfis, error: perfErr } = await supabase
          .from('perfis_para_busca')
          .select('usuario_id, username, nome, foto_url')
          .in('usuario_id', profIds)
        if (perfErr) console.error('[PopupAvaliacoes] perfis avaliadores:', perfErr.message)
        for (const p of perfis ?? []) {
          const uid = String(p.usuario_id ?? '')
          if (!uid) continue
          porProfId.set(uid, {
            nome: String(p.nome ?? 'Turista'),
            username: String(p.username ?? ''),
            fotoUrl: fotoPerfil(p.foto_url),
          })
        }
      } else if (profIds.length) {
        const selectProf =
          'id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url'
        const [{ data: porId, error: porIdErr }, { data: porUsuario, error: porUsuarioErr }] =
          await Promise.all([
            supabase.from('profissionais').select(selectProf).in('id', profIds),
            supabase.from('profissionais').select(selectProf).in('usuario_id', profIds),
          ])
        if (porIdErr) console.error('[PopupAvaliacoes] profissionais by id:', porIdErr.message)
        if (porUsuarioErr) {
          console.error('[PopupAvaliacoes] profissionais by usuario_id:', porUsuarioErr.message)
        }

        for (const p of [...(porId ?? []), ...(porUsuario ?? [])]) {
          const row = {
            nome: String(p.nome_completo ?? 'Profissional'),
            username: String(p.nome_usuario ?? ''),
            fotoUrl: fotoPerfil(p.foto_perfil_url) ?? fotoPerfil(p.foto_url),
          }
          if (p.id) porProfId.set(String(p.id), row)
          if (p.usuario_id) porProfId.set(String(p.usuario_id), row)
        }
      }

      return rowsProf.map((r) => {
        const alvo = String(perfilProfissional ? r.usuario_id : r.alvo_id)
        const prof = porProfId.get(alvo)
        return {
          id: String(r.id),
          nota: Number(r.nota) || 0,
          feedback: r.feedback != null ? String(r.feedback) : null,
          created_at: String(r.created_at ?? ''),
          nome: prof?.nome ?? (perfilProfissional ? 'Turista' : '—'),
          username: prof?.username ?? '',
          fotoUrl: prof?.fotoUrl ?? null,
          categoria: null,
          resposta: null,
        }
      })
    }

    try {
      const [empresas, profissionais] = await Promise.all([
        carregarEmpresas(),
        carregarProfissionais(),
      ])
      if (carregamentoId !== carregamentoIdRef.current) return
      setListaEmpresas(empresas)
      setListaProfissionais(profissionais)
    } finally {
      if (carregamentoId === carregamentoIdRef.current) setCarregando(false)
    }
  }, [perfilTipo, profileId, profissionalId])

  useEffect(() => {
    if (!aberto) {
      carregamentoIdRef.current += 1
      setCarregando(false)
      return
    }

    const abaPadrao =
      abaInicial === 'feedback' && perfilTipo === 'profissional'
        ? 'feedback'
        : abaInicial === 'profissional' && perfilTipo !== 'profissional'
          ? 'profissional'
          : abaInicial === 'empresa'
            ? 'empresa'
            : perfilTipo === 'profissional'
              ? 'feedback'
              : 'empresa'
    setAba(abaPadrao)
    void carregar()
  }, [aberto, abaInicial, carregar, perfilTipo])

  useEffect(() => {
    if (perfilTipo === 'profissional' && aba === 'profissional') setAba('feedback')
    if (perfilTipo !== 'profissional' && aba === 'feedback') setAba('profissional')
  }, [aba, perfilTipo])

  const filtradas = aba === 'empresa' ? listaEmpresas : listaProfissionais
  const labelA = 'EMPRESAS'
  const labelB = perfilTipo === 'profissional' ? 'FEEDBACK' : 'PROFISSIONAIS'
  const segundaAba = perfilTipo === 'profissional' ? 'feedback' : 'profissional'

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onFechar} role="presentation">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: 'min(70vh, 85vh)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-gray-100 bg-white pt-4 pb-2">
          <div className="flex items-center justify-center gap-2">
            <Star className="h-5 w-5 text-[#0097b2]" />
            <h2 className="text-xl font-bold text-[#0097b2]">AVALIAÇÕES</h2>
          </div>
          <button type="button" onClick={onFechar} className="absolute right-3 top-3 rounded-full p-1 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>

        <div className="flex shrink-0 justify-center gap-4 border-b px-4 pb-2">
          <button
            type="button"
            onClick={() => setAba('empresa')}
            className={`flex-1 py-2 text-center text-sm ${
              aba === 'empresa' ? 'border-b-2 border-[#0097b2] font-semibold text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            {labelA} ({listaEmpresas.length})
          </button>
          <button
            type="button"
            onClick={() => setAba(segundaAba)}
            className={`flex-1 py-2 text-center text-sm ${
              aba === segundaAba ? 'border-b-2 border-[#0097b2] font-semibold text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            {labelB} ({listaProfissionais.length})
          </button>
        </div>

        <div className="scrollbar-perfil min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
          {carregando ? (
            <p className="py-8 text-center text-sm text-gray-500">Carregando avaliações…</p>
          ) : filtradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Nenhum item encontrado</p>
          ) : null}
          {!carregando ? filtradas.map((r) => (
            <div key={r.id} className="rounded-lg bg-white p-4 shadow-sm">
              <div className="flex justify-center">
                <div className="flex min-w-0 max-w-full items-center gap-3 text-left">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    <AvatarImage src={r.fotoUrl} alt="" fill className="object-cover" sizes="40px" />
                  </div>
                  <div className="min-w-0">
                    <p className="max-w-full truncate text-sm font-semibold text-gray-900">
                      <NomeComVerificacao
                        nome={r.nome}
                        verificado={Boolean(r.verificado)}
                        verificadoTipo={r.role === 'empresa' ? 'empresa' : 'profissional'}
                        nomeClassName="truncate"
                      />
                    </p>
                    {r.username ? (
                      <p className="max-w-full truncate text-sm text-[#0097b2]">
                        @{String(r.username).replace(/^@+/, '')}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-col items-center text-center">
                <div className="flex items-center justify-center gap-0.5" aria-label={`Nota ${r.nota} de 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 shrink-0 ${i < r.nota ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                      aria-hidden
                    />
                  ))}
                </div>
                {formatarDataAvaliacao(r.created_at) ? (
                  <time className="mt-0.5 text-xs text-[#0097b2]/80">{formatarDataAvaliacao(r.created_at)}</time>
                ) : null}
                {r.feedback ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{r.feedback}</p>
                ) : null}
              </div>
              {r.resposta ? (
                <p className="mt-3 rounded-lg bg-gray-50 p-3 text-center text-sm leading-relaxed text-gray-700">
                  {r.resposta}
                </p>
              ) : null}
            </div>
          )) : null}
        </div>
      </div>
    </div>
  )
}
