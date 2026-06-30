'use client'

import { useCallback, useEffect, useState } from 'react'
import ModoApresentacaoIcon from '@/components/ModoApresentacaoIcon'
import { supabase } from '@/lib/supabase'
import {
  COR_AZUL_LOGO,
  COR_ESTAMOS_LOTADO,
  COR_QUARTOS_LIVRES,
  normalizarDisponibilidadeHospedagem,
} from '@/lib/hospedagemDisponibilidade'

/**
 * @param {{ empresaId: string, onSalvo?: () => void }} props
 */
export default function DisponibilidadeHospedagem({ empresaId, onSalvo }) {
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [selecionado, setSelecionado] = useState(/** @type {'livre' | 'lotado'} */ ('livre'))
  const [atual, setAtual] = useState(/** @type {'livre' | 'lotado' | null} */ (null))

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const { data } = await supabase
        .from('empresas')
        .select('hospedagem_disponibilidade')
        .eq('id', empresaId)
        .maybeSingle()

      const valor = normalizarDisponibilidadeHospedagem(data?.hospedagem_disponibilidade) ?? 'livre'
      setAtual(valor)
      setSelecionado(valor)
    } finally {
      setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const confirmar = async () => {
    if (!empresaId) return
    setSalvando(true)
    setSalvo(false)
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ hospedagem_disponibilidade: selecionado })
        .eq('id', empresaId)

      if (error) {
        alert(error.message ?? 'Não foi possível salvar.')
        return
      }

      setAtual(selecionado)
      setSalvo(true)
      onSalvo?.()
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <p className="px-1 text-sm text-gray-500">Carregando…</p>
  }

  const btnBase =
    'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-bold uppercase tracking-wide transition'
  const livreAtivo = selecionado === 'livre'
  const lotadoAtivo = selecionado === 'lotado'

  return (
    <div className="space-y-4 px-1 pb-4">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setSelecionado('livre')
            setSalvo(false)
          }}
          className={`${btnBase} ${livreAtivo ? 'text-white ring-4 ring-[#00D443]/40' : 'text-[#666666]'}`}
          style={{ backgroundColor: livreAtivo ? COR_QUARTOS_LIVRES : '#e5e7eb' }}
        >
          <ModoApresentacaoIcon
            iconeKey="anfitriao"
            className={`h-5 w-5 ${livreAtivo ? 'text-white' : 'text-[#666666]'}`}
          />
          QUARTOS LIVRES
        </button>

        <button
          type="button"
          onClick={() => {
            setSelecionado('lotado')
            setSalvo(false)
          }}
          className={`${btnBase} ${lotadoAtivo ? 'text-white ring-4 ring-red-300/50' : 'text-[#666666]'}`}
          style={{ backgroundColor: lotadoAtivo ? COR_ESTAMOS_LOTADO : '#e5e7eb' }}
        >
          <ModoApresentacaoIcon
            iconeKey="hospedagem"
            className={`h-5 w-5 ${lotadoAtivo ? 'text-white' : 'text-[#666666]'}`}
          />
          ESTAMOS LOTADO
        </button>

        <button
          type="button"
          onClick={() => {
            void confirmar()
          }}
          disabled={salvando || (atual === selecionado && salvo)}
          className="mx-auto flex w-[85%] items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wide text-white transition disabled:opacity-50"
          style={{ backgroundColor: COR_AZUL_LOGO }}
        >
          <ModoApresentacaoIcon iconeKey="anfitriao" className="h-4 w-4 text-white" />
          {salvando ? 'Salvando…' : 'Confirmar'}
        </button>
      </div>

      {salvo ? (
        <p className="text-center text-xs font-medium text-[#0097b2]">Disponibilidade atualizada.</p>
      ) : null}
    </div>
  )
}
