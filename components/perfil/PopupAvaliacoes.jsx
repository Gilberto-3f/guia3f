'use client'

import { useCallback, useEffect, useState } from 'react'
import { Star, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import AvatarImage from '@/components/AvatarImage'

/**
 * @typedef {{ id: string; nota: number; feedback: string | null; created_at: string; nome: string; username: string; fotoUrl: string | null; categoria: string | null }} LinhaAvaliacao
 */

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   profileId: string
 *   perfilTipo: 'turista' | 'profissional'
 * }} props
 */
export default function PopupAvaliacoes({ aberto, onFechar, profileId, perfilTipo: _perfilTipo }) {
  useModalScrollLock(aberto)
  const [aba, setAba] = useState(/** @type {'empresa' | 'profissional'} */ ('empresa'))
  const [listaEmpresas, setListaEmpresas] = useState(/** @type {LinhaAvaliacao[]} */ ([]))
  const [listaProfissionais, setListaProfissionais] = useState(/** @type {LinhaAvaliacao[]} */ ([]))

  const carregar = useCallback(async () => {
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

    setListaEmpresas(
      rowsEmp.map((r) => {
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
        }
      })
    )

    const { data: avProf, error: errProf } = await supabase
      .from('avaliacoes')
      .select('id, nota, feedback, created_at, alvo_id, alvo_tipo')
      .eq('usuario_id', profileId)
      .eq('alvo_tipo', 'profissional')
      .order('created_at', { ascending: false })

    if (errProf) console.error('[PopupAvaliacoes] avaliacoes profissional:', errProf.message)

    const rowsProf = avProf ?? []
    const profIds = [...new Set(rowsProf.map((r) => String(r.alvo_id)).filter(Boolean))]
    /** @type {Map<string, { nome_completo: string; nome_usuario: string }>} */
    const porProfId = new Map()
    if (profIds.length) {
      const { data: profs, error: pErr } = await supabase
        .from('profissionais')
        .select('id, usuario_id, nome_completo, nome_usuario')
        .in('id', profIds)
      if (pErr) console.error('[PopupAvaliacoes] profissionais by id:', pErr.message)

      const encontrados = new Set((profs ?? []).map((p) => String(p.id)))
      const faltam = profIds.filter((id) => !encontrados.has(id))

      for (const p of profs ?? []) {
        porProfId.set(String(p.id), {
          nome_completo: String(p.nome_completo ?? 'Profissional'),
          nome_usuario: String(p.nome_usuario ?? ''),
        })
      }

      if (faltam.length) {
        const { data: profsU, error: pUErr } = await supabase
          .from('profissionais')
          .select('id, usuario_id, nome_completo, nome_usuario')
          .in('usuario_id', faltam)
        if (pUErr) console.error('[PopupAvaliacoes] profissionais by usuario_id:', pUErr.message)
        for (const p of profsU ?? []) {
          const uid = String(p.usuario_id ?? '')
          if (uid) {
            porProfId.set(uid, {
              nome_completo: String(p.nome_completo ?? 'Profissional'),
              nome_usuario: String(p.nome_usuario ?? ''),
            })
          }
        }
      }
    }

    setListaProfissionais(
      rowsProf.map((r) => {
        const alvo = String(r.alvo_id)
        const prof = porProfId.get(alvo)
        return {
          id: String(r.id),
          nota: Number(r.nota) || 0,
          feedback: r.feedback != null ? String(r.feedback) : null,
          created_at: String(r.created_at ?? ''),
          nome: prof?.nome_completo ?? '—',
          username: prof?.nome_usuario ?? '',
          fotoUrl: null,
          categoria: null,
        }
      })
    )
  }, [profileId])

  useEffect(() => {
    if (aberto) void carregar()
  }, [aberto, carregar])

  useEffect(() => {
    if (listaProfissionais.length === 0 && aba === 'profissional') setAba('empresa')
  }, [listaProfissionais.length, aba])

  const filtradas = aba === 'empresa' ? listaEmpresas : listaProfissionais
  const labelA = 'EMPRESAS'
  const labelB = 'PROFISSIONAIS'
  const mostrarAbaProfissionais = listaProfissionais.length > 0

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

        <div className={`flex shrink-0 justify-center gap-4 border-b px-4 pb-2 ${mostrarAbaProfissionais ? '' : 'justify-center'}`}>
          <button
            type="button"
            onClick={() => setAba('empresa')}
            className={`${mostrarAbaProfissionais ? 'flex-1' : 'w-full'} py-2 text-center text-sm ${
              aba === 'empresa' ? 'border-b-2 border-[#0097b2] font-semibold text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            {labelA} ({listaEmpresas.length})
          </button>
          {mostrarAbaProfissionais ? (
            <button
              type="button"
              onClick={() => setAba('profissional')}
              className={`flex-1 py-2 text-center text-sm ${
                aba === 'profissional' ? 'border-b-2 border-[#0097b2] font-semibold text-[#0097b2]' : 'text-gray-500'
              }`}
            >
              {labelB} ({listaProfissionais.length})
            </button>
          ) : null}
        </div>

        <div className="scrollbar-perfil min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
          {filtradas.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhum item encontrado</p> : null}
          {filtradas.map((r) => (
            <div key={r.id} className="border-b border-gray-100 py-4 last:border-0">
              <div className="flex flex-col items-center text-center">
                <div className="relative h-12 w-12 overflow-hidden rounded-md bg-gray-100">
                  <AvatarImage src={r.fotoUrl} alt="" fill className="object-cover" sizes="48px" />
                </div>
                <p className="mt-2 max-w-full truncate text-sm font-semibold text-gray-900">{r.nome}</p>
                {r.username ? <p className="max-w-full truncate text-sm text-gray-500">@{r.username}</p> : null}
                <div className="mt-3 flex items-center justify-center gap-0.5" aria-label={`Nota ${r.nota} de 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`h-6 w-6 shrink-0 ${i < r.nota ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
              {r.feedback ? (
                <p className="mt-3 whitespace-pre-wrap text-left text-sm leading-relaxed text-gray-800">{r.feedback}</p>
              ) : null}
              <time className="mt-2 block text-center text-xs text-gray-400">
                {new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
