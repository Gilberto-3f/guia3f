'use client'

import { useCallback, useEffect, useState } from 'react'
import { Star, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const CAT_EMPRESAS = new Set(['Restaurantes', 'Hospedagem', 'Lojas', 'Compras Paraguai'])

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   profileId: string
 *   perfilTipo: 'turista' | 'profissional'
 * }} props
 */
export default function PopupAvaliacoes({ aberto, onFechar, profileId, perfilTipo }) {
  const [aba, setAba] = useState(/** @type {'a' | 'b'} */ ('a'))
  const [lista, setLista] = useState(
    /** @type {{ id: string; nota: number; comentario: string | null; created_at: string; nome: string; username: string; categoria: string | null }[]} */ (
      []
    )
  )

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('avaliacoes')
      .select('id, nota, comentario, created_at, empresas(nome_fantasia, nome_usuario, categoria)')
      .eq('usuario_id', profileId)
      .order('created_at', { ascending: false })

    const rows =
      data?.map((r) => {
        const e = r.empresas
        const er = e && typeof e === 'object' && !Array.isArray(e) ? /** @type {Record<string, unknown>} */ (e) : null
        return {
          id: String(r.id),
          nota: Number(r.nota) || 0,
          comentario: r.comentario != null ? String(r.comentario) : null,
          created_at: String(r.created_at ?? ''),
          nome: er ? String(er.nome_fantasia ?? 'Empresa') : '—',
          username: er ? String(er.nome_usuario ?? '') : '',
          categoria: er && er.categoria != null ? String(er.categoria) : null,
        }
      }) ?? []

    setLista(rows)
  }, [profileId])

  useEffect(() => {
    if (aberto) void carregar()
  }, [aberto, carregar])

  const filtradas = lista.filter((r) => {
    const cat = r.categoria || ''
    const emp = CAT_EMPRESAS.has(cat)
    if (aba === 'a') return emp
    return !emp
  })

  const labelA = 'EMPRESAS'
  const labelB = perfilTipo === 'turista' ? 'PROFISSIONAIS' : 'TURISTAS'

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative border-b border-gray-100 bg-white pt-4 pb-2">
          <div className="flex items-center justify-center gap-2">
            <Star className="h-5 w-5 text-[#0097b2]" />
            <h2 className="text-xl font-bold text-[#0097b2]">AVALIAÇÕES</h2>
          </div>
          <button type="button" onClick={onFechar} className="absolute right-3 top-3 rounded-full p-1 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>

        <div className="flex justify-center gap-4 border-b px-4 pb-2">
          <button
            type="button"
            onClick={() => setAba('a')}
            className={`flex-1 py-2 text-center text-sm ${aba === 'a' ? 'border-b-2 border-[#0097b2] font-semibold text-[#0097b2]' : 'text-gray-500'}`}
          >
            {labelA} ({lista.filter((r) => CAT_EMPRESAS.has(r.categoria || '')).length})
          </button>
          <button
            type="button"
            onClick={() => setAba('b')}
            className={`flex-1 py-2 text-center text-sm ${aba === 'b' ? 'border-b-2 border-[#0097b2] font-semibold text-[#0097b2]' : 'text-gray-500'}`}
          >
            {labelB} ({lista.filter((r) => !CAT_EMPRESAS.has(r.categoria || '')).length})
          </button>
        </div>

        <div className="scrollbar-perfil flex-1 overflow-y-auto px-4 py-2">
          {filtradas.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhum item encontrado</p> : null}
          {filtradas.map((r) => (
            <div key={r.id} className="border-b border-gray-100 py-2 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">{r.nome}</p>
                  <p className="truncate text-sm text-gray-500">@{r.username}</p>
                </div>
                <div className="flex shrink-0 text-amber-400">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={14} className={i < r.nota ? 'fill-amber-400' : 'fill-gray-200 text-gray-200'} />
                  ))}
                </div>
              </div>
              {r.comentario ? <p className="mt-2 text-sm text-[#666666]">{r.comentario}</p> : null}
              <time className="mt-1 block text-xs text-gray-400">
                {new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
