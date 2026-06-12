'use client'

import { useCallback, useEffect, useState } from 'react'
import { ROTULOS_BENEFICIO } from '@/lib/comissoesBeneficiosInfo'
import { supabase } from '@/lib/supabase'
import { useSharedAdminGate } from '../context/AdminPermissaoContext'
import { adminContextFromGate, registrarLogVerificacao } from '../utils/registrarLogVerificacao'

export type BeneficiosOferta = {
  pax?: { ativo?: boolean; valor?: number }
  percentual?: { ativo?: boolean; valor?: number }
  fixo?: { ativo?: boolean; valor?: number }
  extra?: { ativo?: boolean; texto?: string }
  por_tempo_limitado?: boolean
}

export type OfertaComissaoAdm = {
  id: string
  empresaId: string
  categoriaProfissional: string
  beneficios: BeneficiosOferta
  dataValidade: string | null
  status: string
  createdAt: string
  empresaNome: string
  empresaUsername: string
  empresaFotoUrl: string | null
  empresaCategoria: string
  empresaCidade: string
}

const SEM_PRAZO_DATA = '2099-12-31'

function parseOfertaRow(row: Record<string, unknown>): OfertaComissaoAdm | null {
  const id = String(row.id ?? '').trim()
  if (!id) return null
  const empRaw = row.empresas
  const emp =
    empRaw && typeof empRaw === 'object' && !Array.isArray(empRaw)
      ? (empRaw as Record<string, unknown>)
      : null

  const rawBen = row.beneficios
  const beneficios =
    rawBen && typeof rawBen === 'object' && !Array.isArray(rawBen) ? (rawBen as BeneficiosOferta) : {}

  return {
    id,
    empresaId: String(row.empresa_id ?? ''),
    categoriaProfissional: String(row.categoria_profissional ?? ''),
    beneficios,
    dataValidade: row.data_validade != null ? String(row.data_validade).slice(0, 10) : null,
    status: String(row.status ?? 'pendente'),
    createdAt: String(row.created_at ?? ''),
    empresaNome: String(emp?.nome_fantasia ?? 'Empresa'),
    empresaUsername: String(emp?.nome_usuario ?? '').replace(/^@+/, ''),
    empresaFotoUrl: emp?.foto_url != null ? String(emp.foto_url) : null,
    empresaCategoria: String(emp?.categoria ?? '—'),
    empresaCidade: String(emp?.cidade ?? '—'),
  }
}

export function listarBeneficiosAtivos(b: BeneficiosOferta) {
  const itens: { label: string; valor: string }[] = []
  if (b.pax?.ativo) itens.push({ label: ROTULOS_BENEFICIO.pax, valor: `R$ ${b.pax.valor ?? 0}` })
  if (b.percentual?.ativo) itens.push({ label: ROTULOS_BENEFICIO.percentual, valor: `${b.percentual.valor ?? 0}%` })
  if (b.fixo?.ativo) itens.push({ label: ROTULOS_BENEFICIO.fixo, valor: `R$ ${b.fixo.valor ?? 0}` })
  if (b.extra?.ativo && String(b.extra.texto ?? '').trim()) {
    itens.push({ label: ROTULOS_BENEFICIO.extra, valor: String(b.extra.texto).trim() })
  }
  return itens
}

export function textoValidadeOferta(oferta: OfertaComissaoAdm) {
  if (oferta.beneficios.por_tempo_limitado !== true) return null
  const data = oferta.dataValidade ?? ''
  if (!data || data === SEM_PRAZO_DATA) return null
  return `Por tempo limitado até ${new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')}`
}

export type StatusFiltroOfertaAdm = 'pendente' | 'arquivados'

export function useComissaoOfertaAdm(statusFiltro: StatusFiltroOfertaAdm = 'pendente') {
  const gate = useSharedAdminGate()
  const admin = gate.status === 'ok' ? gate.admin : null

  const [ofertas, setOfertas] = useState<OfertaComissaoAdm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [acaoId, setAcaoId] = useState<string | null>(null)

  const fetchOfertas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('comissao_oferta')
        .select(
          `
          id,
          empresa_id,
          categoria_profissional,
          beneficios,
          data_validade,
          status,
          created_at,
          empresas (
            id,
            nome_fantasia,
            nome_usuario,
            foto_url,
            categoria,
            cidade
          )
        `
        )
        .order('created_at', { ascending: false })

      if (statusFiltro === 'pendente') {
        query = query.eq('status', 'pendente')
      } else if (statusFiltro === 'arquivados') {
        query = query.in('status', ['aprovada', 'reprovada'])
      }

      const { data, error: e } = await query
      if (e) throw e

      const parsed = (data ?? [])
        .map((row) => parseOfertaRow(row as Record<string, unknown>))
        .filter((o): o is OfertaComissaoAdm => o != null)

      setOfertas(parsed)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar ofertas'))
      setOfertas([])
    } finally {
      setLoading(false)
    }
  }, [statusFiltro])

  useEffect(() => {
    void fetchOfertas()
  }, [fetchOfertas])

  const atualizarStatus = useCallback(
    async (id: string, status: 'aprovada' | 'reprovada') => {
      const oferta = ofertas.find((o) => o.id === id)
      setAcaoId(id)
      try {
        const { error: e } = await supabase.from('comissao_oferta').update({ status }).eq('id', id)
        if (e) throw e

        if (admin) {
          await registrarLogVerificacao({
            tipo: 'comissao_oferta',
            perfil_id: id,
            acao: status === 'aprovada' ? 'comissao_aprovada' : 'comissao_reprovada',
            status_final: status,
            admin: adminContextFromGate(admin),
            alvo_id: oferta?.empresaId ?? null,
            detalhes: {
              modulo: 'analise_beneficios',
              empresa_nome: oferta?.empresaNome,
              empresa_username: oferta?.empresaUsername,
              comunidade: oferta?.categoriaProfissional,
            },
          })
        }

        if (statusFiltro === 'pendente') {
          setOfertas((prev) => prev.filter((o) => o.id !== id))
        } else {
          void fetchOfertas()
        }
      } finally {
        setAcaoId(null)
      }
    },
    [admin, fetchOfertas, ofertas, statusFiltro]
  )

  return {
    ofertas,
    loading,
    error,
    acaoId,
    refetch: fetchOfertas,
    aprovar: (id: string) => atualizarStatus(id, 'aprovada'),
    reprovar: (id: string) => atualizarStatus(id, 'reprovada'),
  }
}
