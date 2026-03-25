'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MessageCircle, Building2, Crown } from 'lucide-react'

/**
 * @typedef {{
 *   id: string
 *   nome: string
 *   tipo_publico: string | null
 *   categoria: string | null
 *   pais: string | null
 *   ordem_tipo: string | null
 *   ultima_mensagem_em: string | null
 *   nao_lidas?: number
 * }} Canal
 */

/**
 * @param {{
 *   tipoPublico?: string | null
 *   paisFiltro?: string
 *   onSelectCanal: (c: Canal) => void
 *   canalSelecionadoId?: string
 *   agruparPorTipo?: boolean
 * }} props
 */
export default function ListaCanais({
  tipoPublico,
  paisFiltro = 'geral',
  onSelectCanal,
  canalSelecionadoId,
  agruparPorTipo = false,
}) {
  const [canais, setCanais] = useState(/** @type {Canal[]} */ ([]))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const carregarCanais = async () => {
      setLoading(true)
      try {
        let query = supabase.from('canais').select('*').eq('ativo', true)

        if (tipoPublico != null && tipoPublico !== '') {
          query = query.eq('tipo_publico', tipoPublico)
        }

        if (paisFiltro && paisFiltro !== 'geral') {
          query = query.or(`pais.eq.${paisFiltro},pais.eq.geral`)
        }

        const { data, error } = await query

        if (error) throw error

        const lista = data ?? []
        const fixos = lista.filter((c) => c.ordem_tipo === 'fixo').sort((a, b) => (a.ordem_posicao ?? 0) - (b.ordem_posicao ?? 0))
        const rotativos = lista.filter((c) => c.ordem_tipo !== 'fixo')
        rotativos.sort((a, b) => {
          const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
          const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
          return tb - ta
        })

        setCanais([...fixos, ...rotativos])
      } catch (e) {
        console.error('Erro ao carregar canais:', e)
      } finally {
        setLoading(false)
      }
    }

    void carregarCanais()
  }, [tipoPublico, paisFiltro])

  /**
   * @param {Canal} canal
   */
  const getIcon = (canal) => {
    if (canal.nome === 'ADM' || canal.nome === 'Mensageiro ADM') return Crown
    if (canal.tipo_publico === 'empresa') return Building2
    return MessageCircle
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  if (agruparPorTipo) {
    const porTipo = /** @type {Record<string, Canal[]>} */ ({})
    for (const c of canais) {
      const k = c.tipo_publico ?? 'outros'
      if (!porTipo[k]) porTipo[k] = []
      porTipo[k].push(c)
    }
    const labels = {
      admin: 'Administrador',
      turista: 'Turista',
      profissional: 'Profissionais',
      empresa: 'Empresas',
      outros: 'Outros',
    }
    return (
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {Object.entries(porTipo).map(([tipo, itens]) => (
          <div key={tipo}>
            <div className="border-b border-gray-100 bg-gray-50 px-3 py-2">
              <span className="text-xs font-medium text-gray-500">{labels[tipo] ?? tipo}</span>
            </div>
            {itens.map((canal) => renderRow(canal))}
          </div>
        ))}
      </div>
    )
  }

  /**
   * @param {Canal} canal
   */
  function renderRow(canal) {
    const Icon = getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    return (
      <button
        key={canal.id}
        type="button"
        onClick={() => onSelectCanal(canal)}
        className={`flex w-full items-center gap-3 border-b border-gray-100 p-4 text-left transition-colors ${
          isActive ? 'bg-[#0097b2]/5' : 'hover:bg-gray-50'
        }`}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isActive ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-800">{canal.nome}</h3>
          {canal.nao_lidas != null && canal.nao_lidas > 0 ? (
            <span className="mt-1 inline-block rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{canal.nao_lidas}</span>
          ) : null}
        </div>
      </button>
    )
  }

  return <div className="overflow-hidden rounded-xl bg-white shadow-sm">{canais.map((canal) => renderRow(canal))}</div>
}
