'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ConfigAPIs, ConfigAmbienteAPI, ConfigGeral } from '../types/admin.types'
import { useSharedAdminGate } from '../context/AdminPermissaoContext'

function parseMoedas(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v) as unknown
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

function parseCotacoesManual(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, number> = {}
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(raw)
    if (k && Number.isFinite(n) && n > 0) out[k.toUpperCase()] = n
  }
  return out
}

function mapRowToApis(row: Record<string, unknown>): ConfigAPIs {
  const amb = String(row.ambiente ?? 'teste')
  const ambiente: ConfigAmbienteAPI = amb === 'producao' ? 'producao' : 'teste'
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    gateway: String(row.gateway ?? 'stripe'),
    chave_publica: String(row.chave_publica ?? ''),
    chave_secreta: String(row.chave_secreta ?? ''),
    webhook_secret: String(row.webhook_secret ?? ''),
    ambiente,
    moedas: parseMoedas(row.moedas),
    api_mobilidade_url: String(row.api_mobilidade_url ?? ''),
    api_mobilidade_key: String(row.api_mobilidade_key ?? ''),
    app_parceiro_link: String(row.app_parceiro_link ?? ''),
    api_mobilidade_url_foz: String(row.api_mobilidade_url_foz ?? row.api_mobilidade_url ?? ''),
    api_mobilidade_key_foz: String(row.api_mobilidade_key_foz ?? row.api_mobilidade_key ?? ''),
    app_parceiro_link_foz: String(row.app_parceiro_link_foz ?? row.app_parceiro_link ?? ''),
    api_mobilidade_url_cde: String(row.api_mobilidade_url_cde ?? row.api_mobilidade_url ?? ''),
    api_mobilidade_key_cde: String(row.api_mobilidade_key_cde ?? row.api_mobilidade_key ?? ''),
    app_parceiro_link_cde: String(row.app_parceiro_link_cde ?? row.app_parceiro_link ?? ''),
    cotacoes_modo: row.cotacoes_modo === 'manual' ? 'manual' : 'api',
    cotacoes_fonte_url: String(
      row.cotacoes_fonte_url ??
        'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,ARS-BRL,PYG-BRL',
    ),
    cotacoes_manual: parseCotacoesManual(row.cotacoes_manual),
    cotacoes_sync_em: row.cotacoes_sync_em != null ? String(row.cotacoes_sync_em) : null,
  }
}

function mapRowToGeral(row: Record<string, unknown>): ConfigGeral {
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    politicas_privacidade: String(row.politicas_privacidade ?? ''),
    termos_uso: String(row.termos_uso ?? ''),
    regras_ecossistema: String(row.regras_ecossistema ?? ''),
    prazo_pre_aprovacao_turista: Number(row.prazo_pre_aprovacao_turista ?? 48),
    prazo_verificacao_documentos: Number(row.prazo_verificacao_documentos ?? 24),
    limite_fotos_empresa: Number(row.limite_fotos_empresa ?? 20),
    limite_reservas_ativas: Number(row.limite_reservas_ativas ?? 3),
    tempo_pagamento_reserva: Number(row.tempo_pagamento_reserva ?? 15),
  }
}

const defaultApis = (): ConfigAPIs => ({
  gateway: 'stripe',
  chave_publica: '',
  chave_secreta: '',
  webhook_secret: '',
  ambiente: 'teste',
  moedas: ['BRL', 'PYG', 'ARS'],
  api_mobilidade_url: '',
  api_mobilidade_key: '',
  app_parceiro_link: '',
  api_mobilidade_url_foz: '',
  api_mobilidade_key_foz: '',
  app_parceiro_link_foz: '',
  api_mobilidade_url_cde: '',
  api_mobilidade_key_cde: '',
  app_parceiro_link_cde: '',
  cotacoes_modo: 'api',
  cotacoes_fonte_url:
    'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,ARS-BRL,PYG-BRL',
  cotacoes_manual: {},
  cotacoes_sync_em: null,
})

const defaultGeral = (): ConfigGeral => ({
  politicas_privacidade: '## Políticas de Privacidade\n\nEm construção...',
  termos_uso: '## Termos de Uso\n\nEm construção...',
  regras_ecossistema: '[]',
  prazo_pre_aprovacao_turista: 48,
  prazo_verificacao_documentos: 24,
  limite_fotos_empresa: 20,
  limite_reservas_ativas: 3,
  tempo_pagamento_reserva: 15,
})

export function useConfiguracoes() {
  const gate = useSharedAdminGate()
  const [apis, setApis] = useState<ConfigAPIs | null>(null)
  const [geral, setGeral] = useState<ConfigGeral | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const admin = gate.status === 'ok' ? gate.admin : null
  const isAdminGeral = admin?.admin_level === 1
  const rawCargo = (admin?.admin_permissoes as unknown as { cargo?: string })?.cargo
  const isFinanceiro = rawCargo === 'FINANCEIRO'
  const podeEditarAPIs = Boolean(isAdminGeral || isFinanceiro)
  const podeEditarGeral = Boolean(isAdminGeral)

  const fetchConfiguracoes = useCallback(async () => {
    if (!admin) return
    setLoading(true)
    setError(null)
    try {
      const { data: apisData, error: apisError } = await supabase.from('config_apis').select('*').limit(1).maybeSingle()
      if (apisError) throw apisError
      if (apisData) setApis(mapRowToApis(apisData as Record<string, unknown>))
      else setApis(defaultApis())

      const { data: geralData, error: geralError } = await supabase.from('config_geral').select('*').limit(1).maybeSingle()
      if (geralError) throw geralError
      if (geralData) setGeral(mapRowToGeral(geralData as Record<string, unknown>))
      else setGeral(defaultGeral())
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar configurações'))
    } finally {
      setLoading(false)
    }
  }, [admin])

  useEffect(() => {
    if (gate.status === 'loading') return
    if (gate.status !== 'ok' || !admin) {
      setLoading(false)
      return
    }
    void fetchConfiguracoes()
  }, [gate.status, admin, fetchConfiguracoes])

  const salvarAPIs = useCallback(
    async (novasConfig: ConfigAPIs) => {
      if (!admin || !podeEditarAPIs) throw new Error('Permissão negada')
      const payload = {
        gateway: novasConfig.gateway,
        chave_publica: novasConfig.chave_publica || null,
        chave_secreta: novasConfig.chave_secreta || null,
        webhook_secret: novasConfig.webhook_secret || null,
        ambiente: novasConfig.ambiente,
        moedas: novasConfig.moedas,
        api_mobilidade_url: novasConfig.api_mobilidade_url_foz || novasConfig.api_mobilidade_url || null,
        api_mobilidade_key: novasConfig.api_mobilidade_key_foz || novasConfig.api_mobilidade_key || null,
        app_parceiro_link: novasConfig.app_parceiro_link_foz || novasConfig.app_parceiro_link || null,
        api_mobilidade_url_foz: novasConfig.api_mobilidade_url_foz || null,
        api_mobilidade_key_foz: novasConfig.api_mobilidade_key_foz || null,
        app_parceiro_link_foz: novasConfig.app_parceiro_link_foz || null,
        api_mobilidade_url_cde: novasConfig.api_mobilidade_url_cde || null,
        api_mobilidade_key_cde: novasConfig.api_mobilidade_key_cde || null,
        app_parceiro_link_cde: novasConfig.app_parceiro_link_cde || null,
        cotacoes_modo: novasConfig.cotacoes_modo,
        cotacoes_fonte_url: novasConfig.cotacoes_fonte_url || null,
        cotacoes_manual: novasConfig.cotacoes_manual ?? {},
        atualizado_por: admin.id,
        atualizado_em: new Date().toISOString(),
      }
      const idAlvo = novasConfig.id ?? apis?.id
      if (idAlvo) {
        const { error } = await supabase.from('config_apis').update(payload).eq('id', idAlvo)
        if (error) throw error
      } else {
        const { error } = await supabase.from('config_apis').insert(payload)
        if (error) throw error
      }

      await supabase.from('logs_verificacao').insert({
        tipo: 'configuracoes',
        perfil_id: admin.id,
        acao: 'atualizou_config_apis',
        admin_id: admin.id,
        admin_email: admin.email ?? admin.username ?? 'admin@guia3f',
        admin_nivel: admin.admin_level,
        detalhes: { gateway: novasConfig.gateway, ambiente: novasConfig.ambiente },
      })

      await fetchConfiguracoes()
      return { success: true as const }
    },
    [admin, apis?.id, fetchConfiguracoes, podeEditarAPIs]
  )

  const salvarGeral = useCallback(
    async (novasConfig: ConfigGeral) => {
      if (!admin || !podeEditarGeral) throw new Error('Permissão negada')
      const clamped: ConfigGeral = {
        ...novasConfig,
        prazo_pre_aprovacao_turista: Math.min(72, Math.max(24, Math.round(novasConfig.prazo_pre_aprovacao_turista))),
        prazo_verificacao_documentos: Math.min(48, Math.max(12, Math.round(novasConfig.prazo_verificacao_documentos))),
        limite_fotos_empresa: Math.min(50, Math.max(10, Math.round(novasConfig.limite_fotos_empresa))),
        limite_reservas_ativas: Math.min(5, Math.max(1, Math.round(novasConfig.limite_reservas_ativas))),
        tempo_pagamento_reserva: Math.min(30, Math.max(5, Math.round(novasConfig.tempo_pagamento_reserva))),
      }
      const payload = {
        politicas_privacidade: clamped.politicas_privacidade || null,
        termos_uso: clamped.termos_uso || null,
        regras_ecossistema: clamped.regras_ecossistema || null,
        prazo_pre_aprovacao_turista: clamped.prazo_pre_aprovacao_turista,
        prazo_verificacao_documentos: clamped.prazo_verificacao_documentos,
        limite_fotos_empresa: clamped.limite_fotos_empresa,
        limite_reservas_ativas: clamped.limite_reservas_ativas,
        tempo_pagamento_reserva: clamped.tempo_pagamento_reserva,
        atualizado_por: admin.id,
        atualizado_em: new Date().toISOString(),
      }
      const idGeral = novasConfig.id ?? geral?.id
      if (idGeral) {
        const { error } = await supabase.from('config_geral').update(payload).eq('id', idGeral)
        if (error) throw error
      } else {
        const { error } = await supabase.from('config_geral').insert(payload)
        if (error) throw error
      }

      await supabase.from('logs_verificacao').insert({
        tipo: 'configuracoes',
        perfil_id: admin.id,
        acao: 'atualizou_config_geral',
        admin_id: admin.id,
        admin_email: admin.email ?? admin.username ?? 'admin@guia3f',
        admin_nivel: admin.admin_level,
        detalhes: { prazos: clamped },
      })

      await fetchConfiguracoes()
      return { success: true as const }
    },
    [admin, geral?.id, fetchConfiguracoes, podeEditarGeral]
  )

  return {
    apis,
    geral,
    loading: gate.status === 'loading' || loading,
    error,
    salvarAPIs,
    salvarGeral,
    podeEditarAPIs,
    podeEditarGeral,
    isAdminGeral,
    refetch: fetchConfiguracoes,
  }
}
