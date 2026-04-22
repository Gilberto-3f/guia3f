'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bus, Crown, Landmark, Mail, MessageCircle } from 'lucide-react'

const NOMES_PROFISSIONAIS = ['Motoristas App', 'Vans', 'Táxis', 'Guias', 'Anfitriões']

const NOMES_FIXOS_EMPRESA = ['ADM', 'Financeiro', 'Mensageiro']

/**
 * Título no cabeçalho / lista (nome na BD → rótulo).
 * @param {string} nomeDb
 */
export function tituloCanalEmpresaLista(nomeDb) {
  const map = {
    Vans: 'Motoristas Van',
    'Táxis': 'Taxistas',
    Guias: 'Guias de Turismo',
  }
  return map[nomeDb] ?? nomeDb
}

/**
 * @typedef {{
 *   id: string
 *   nome: string
 *   tipo_publico: string | null
 *   categoria: string | null
 *   ultima_mensagem_em: string | null
 * }} Canal
 */

/**
 * @param {{
 *   onSelectCanal: (c: Canal) => void
 *   canalSelecionadoId?: string
 * }} props
 */
export default function ListaCanaisEmpresa({ onSelectCanal, canalSelecionadoId }) {
  const [fixos, setFixos] = useState(/** @type {Canal[]} */ ([]))
  const [motoristas, setMotoristas] = useState(/** @type {Canal[]} */ ([]))
  const [loading, setLoading] = useState(true)

  const idsMonitor = useMemo(() => [...fixos.map((c) => c.id), ...motoristas.map((c) => c.id)], [fixos, motoristas])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [rFix, rMot] = await Promise.all([
        supabase
          .from('canais')
          .select('id, nome, tipo_publico, categoria, ultima_mensagem_em')
          .eq('tipo_publico', 'empresa')
          .eq('ativo', true)
          .in('nome', NOMES_FIXOS_EMPRESA)
          .order('ordem_posicao', { ascending: true }),
        supabase
          .from('canais')
          .select('id, nome, tipo_publico, categoria, ultima_mensagem_em')
          .eq('tipo_publico', 'profissional')
          .eq('ativo', true)
          .in('nome', NOMES_PROFISSIONAIS),
      ])

      if (rFix.error) throw rFix.error
      if (rMot.error) throw rMot.error

      const f = /** @type {Canal[]} */ (rFix.data ?? [])
      const ordemFixo = (n) => {
        const i = NOMES_FIXOS_EMPRESA.indexOf(n)
        return i === -1 ? 99 : i
      }
      f.sort((a, b) => ordemFixo(a.nome) - ordemFixo(b.nome))

      const m = /** @type {Canal[]} */ (rMot.data ?? [])
      m.sort((a, b) => {
        const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
        const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
        if (tb !== ta) return tb - ta
        return NOMES_PROFISSIONAIS.indexOf(a.nome) - NOMES_PROFISSIONAIS.indexOf(b.nome)
      })

      setFixos(f)
      setMotoristas(m)
    } catch (e) {
      console.error('Erro ao carregar canais empresa:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (idsMonitor.length === 0) return

    const ch = supabase.channel('lista-canais-empresa-mensagens')
    for (const canalId of idsMonitor) {
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_canal', filter: `canal_id=eq.${canalId}` },
        () => {
          void carregar()
        },
      )
    }
    void ch.subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [idsMonitor, carregar])

  /**
   * @param {Canal} canal
   */
  const getIcon = (canal) => {
    if (canal.tipo_publico === 'profissional') return Bus
    if (canal.nome === 'ADM') return Crown
    if (canal.nome === 'Financeiro') return Landmark
    if (canal.nome === 'Mensageiro') return Mail
    return MessageCircle
  }

  /**
   * @param {Canal} canal
   */
  function renderRow(canal) {
    const Icon = getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    const label = tituloCanalEmpresaLista(canal.nome)
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
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isActive ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-800">{label}</h3>
        </div>
      </button>
    )
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {fixos.map((c) => renderRow(c))}
        <div className="border-t border-gray-200 bg-gray-50 py-1" role="separator" aria-hidden />
        {motoristas.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400">Canais com profissionais em configuração.</div>
        ) : (
          motoristas.map((c) => renderRow(c))
        )}
      </div>
    </div>
  )
}
