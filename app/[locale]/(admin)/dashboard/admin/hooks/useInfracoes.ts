'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOptionalAdminGate } from '../context/AdminPermissaoContext'

export type Infracao = {
  id: string
  tipo: 'leve' | 'media' | 'grave' | 'gravissima'
  categoria: 'profissional' | 'empresa' | 'turista' | 'todos'
  descricao: string
  penalidade_padrao: 'advertencia' | 'suspensao' | 'banimento'
  dias_suspensao_padrao: number | null
  alerta_preventivo: boolean
  horas_alerta: number
  restricao_especifica: Record<string, unknown>
}

export type HistoricoDecisao = {
  id: string
  denuncia_id?: string | null
  tipo: 'advertencia' | 'suspensao' | 'banimento' | 'alerta_preventivo' | 'decisao_denuncia' | 'chat_ecossistema'
  titulo: string
  descricao: string
  penalidade_aplicada: string
  duracao_dias: number | null
  data_aplicacao: string
  data_conclusao?: string | null
  data_expiracao: string | null
  status: 'ativo' | 'expirado' | 'cumprido'
  justificativa: string
  visualizado: boolean
}

export function useInfracoes() {
  const gate = useOptionalAdminGate()
  const admin = gate?.status === 'ok' ? gate.admin : null
  const nivel = admin?.admin_level ?? 0
  const [infracoes, setInfracoes] = useState<Infracao[]>([])
  const [historico, setHistorico] = useState<HistoricoDecisao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const isAdminGeral = nivel === 1

  const fetchInfracoes = useCallback(async () => {
    if (!isAdminGeral) return
    try {
      const { data, error: e } = await supabase
        .from('infracoes')
        .select('*')
        .order('tipo', { ascending: true })
        .order('categoria', { ascending: true })
      if (e) {
        console.warn('Infrações não disponíveis:', e.message)
        setInfracoes([])
        return
      }
      setInfracoes((data ?? []) as Infracao[])
    } catch (err) {
      console.warn('Infrações não disponíveis:', err)
      setInfracoes([])
    }
  }, [isAdminGeral])

  const fetchHistoricoUsuario = useCallback(
    async (usuarioId?: string) => {
      try {
        let targetId = usuarioId || admin?.id || null
        if (!targetId) {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          targetId = session?.user?.id ?? null
        }
        if (!targetId) return
        const { data, error: e } = await supabase
          .from('historico_decisoes')
          .select('*')
          .eq('usuario_id', targetId)
          .order('data_conclusao', { ascending: false, nullsFirst: false })
          .order('data_aplicacao', { ascending: false })
        if (e) {
          console.warn('Histórico de decisões não disponível:', e.message)
          setHistorico([])
          return
        }
        setHistorico((data ?? []) as HistoricoDecisao[])
      } catch (err) {
        console.warn('Histórico de decisões não disponível:', err)
        setHistorico([])
      }
    },
    [admin?.id]
  )

  const aplicarAlertaPreventivo = useCallback(async (usuarioId: string, infracaoId: string) => {
    const { data, error: e } = await supabase.rpc('aplicar_alerta_preventivo', { p_usuario_id: usuarioId, p_infracao_id: infracaoId })
    if (e) throw e
    return data
  }, [])

  const escalonarPenalidade = useCallback(async (usuarioId: string, infracaoId: string, tipoUsuario: 'turista' | 'profissional' | 'empresa') => {
    const { data, error: e } = await supabase.rpc('escalonar_penalidade', {
      p_usuario_id: usuarioId,
      p_tipo_usuario: tipoUsuario,
      p_infracao_id: infracaoId,
    })
    if (e) throw e
    return data
  }, [])

  const solicitarDoubleCheckBanimento = useCallback(
    async (usuarioId: string, denunciaId: string, motivo: string) => {
      const { data, error: e } = await supabase
        .from('banimentos_confirmacao')
        .insert({ usuario_id: usuarioId, denuncia_id: denunciaId, solicitado_por: admin?.id, motivo })
        .select()
        .single()
      if (e) throw e
      return data
    },
    [admin?.id]
  )

  const confirmarBanimento = useCallback(
    async (confirmacaoId: string) => {
      const { error: e } = await supabase
        .from('banimentos_confirmacao')
        .update({ status: 'confirmado', confirmado_por: admin?.id, confirmado_em: new Date().toISOString() })
        .eq('id', confirmacaoId)
      if (e) throw e
    },
    [admin?.id]
  )

  const marcarHistoricoComoVisualizado = useCallback(async (historicoId: string) => {
    try {
      const { error: e } = await supabase.from('historico_decisoes').update({ visualizado: true }).eq('id', historicoId)
      if (e) {
        console.warn('Não foi possível marcar histórico como visualizado:', e.message)
      }
    } catch (err) {
      console.warn('Não foi possível marcar histórico como visualizado:', err)
    }
  }, [])

  const upsertInfracao = useCallback(
    async (payload: Partial<Infracao>) => {
      if (!isAdminGeral) throw new Error('Apenas ADM GERAL pode alterar infrações')
      if (!payload.descricao || !payload.tipo || !payload.categoria || !payload.penalidade_padrao) {
        throw new Error('Campos obrigatórios ausentes')
      }
      try {
        if (payload.id) {
          const { error: e } = await supabase.from('infracoes').update(payload).eq('id', payload.id)
          if (e) {
            console.warn('Infrações (atualização) não disponível:', e.message)
            return
          }
        } else {
          const { error: e } = await supabase.from('infracoes').insert(payload)
          if (e) {
            console.warn('Infrações (inserção) não disponível:', e.message)
            return
          }
        }
        await fetchInfracoes()
      } catch (err) {
        console.warn('Infrações (upsert) não disponível:', err)
      }
    },
    [fetchInfracoes, isAdminGeral]
  )

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        if (isAdminGeral) await fetchInfracoes()
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao carregar infrações'))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [fetchInfracoes, isAdminGeral])

  return {
    infracoes,
    historico,
    loading,
    error,
    fetchHistoricoUsuario,
    aplicarAlertaPreventivo,
    escalonarPenalidade,
    solicitarDoubleCheckBanimento,
    confirmarBanimento,
    marcarHistoricoComoVisualizado,
    upsertInfracao,
    isAdminGeral,
  }
}
