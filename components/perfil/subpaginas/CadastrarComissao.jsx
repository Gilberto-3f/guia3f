'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const CATEGORIAS = ['Motorista de APP', 'Motorista de Van', 'Taxista', 'Guia de Turismo', 'Anfitrião']

/**
 * @param {{ empresaId: string }} props
 */
export default function CadastrarComissao({ empresaId }) {
  const [categoria, setCategoria] = useState('')
  const [beneficios, setBeneficios] = useState({
    pax: { ativo: false, valor: 0 },
    percentual: { ativo: false, valor: 0 },
    fixo: { ativo: false, valor: 0 },
    extra: { ativo: false, texto: '' },
  })
  const [validade, setValidade] = useState('')
  const [ofertas, setOfertas] = useState(/** @type {Array<Record<string, unknown>>} */ ([]))
  const [carregando, setCarregando] = useState(true)
  const [msg, setMsg] = useState(/** @type {string | null} */ (null))

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    const { data, error } = await supabase
      .from('comissao_oferta')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
    if (!error && data) setOfertas(data)
    setCarregando(false)
  }, [empresaId])

  useEffect(() => {
    // Carregar ofertas ao montar / mudar empresa (I/O externo)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza lista com Supabase
    void carregar()
  }, [carregar])

  const handleSubmit = async () => {
    if (!categoria || !validade) {
      setMsg('Preencha categoria e validade.')
      return
    }
    setMsg(null)
    const { error } = await supabase.from('comissao_oferta').insert({
      empresa_id: empresaId,
      categoria_profissional: categoria,
      beneficios,
      data_validade: validade,
      status: 'pendente',
    })
    if (error) {
      setMsg(error.message)
      return
    }
    setCategoria('')
    setBeneficios({
      pax: { ativo: false, valor: 0 },
      percentual: { ativo: false, valor: 0 },
      fixo: { ativo: false, valor: 0 },
      extra: { ativo: false, texto: '' },
    })
    setValidade('')
    setMsg('Oferta cadastrada.')
    void carregar()
  }

  return (
    <div className="space-y-6 px-1 pb-2">
      <div>
        <label className="font-medium text-gray-800">Selecione a categoria</label>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm">
          <option value="">Selecione…</option>
          {CATEGORIAS.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {categoria ? (
        <div className="space-y-4">
          <h3 className="font-medium text-gray-800">Benefícios para {categoria}</h3>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="checkbox"
              checked={beneficios.pax.ativo}
              onChange={(e) => setBeneficios({ ...beneficios, pax: { ...beneficios.pax, ativo: e.target.checked } })}
            />
            <span className="text-sm">PAX (por cliente)</span>
            {beneficios.pax.ativo ? (
              <input
                type="number"
                placeholder="Valor (R$)"
                value={beneficios.pax.valor || ''}
                onChange={(e) =>
                  setBeneficios({ ...beneficios, pax: { ...beneficios.pax, valor: parseFloat(e.target.value) || 0 } })
                }
                className="w-32 rounded-lg border border-gray-200 p-2 text-sm"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="checkbox"
              checked={beneficios.percentual.ativo}
              onChange={(e) =>
                setBeneficios({ ...beneficios, percentual: { ...beneficios.percentual, ativo: e.target.checked } })
              }
            />
            <span className="text-sm">% sobre venda</span>
            {beneficios.percentual.ativo ? (
              <input
                type="number"
                placeholder="%"
                value={beneficios.percentual.valor || ''}
                onChange={(e) =>
                  setBeneficios({
                    ...beneficios,
                    percentual: { ...beneficios.percentual, valor: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-32 rounded-lg border border-gray-200 p-2 text-sm"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="checkbox"
              checked={beneficios.fixo.ativo}
              onChange={(e) => setBeneficios({ ...beneficios, fixo: { ...beneficios.fixo, ativo: e.target.checked } })}
            />
            <span className="text-sm">Valor fixo por indicação</span>
            {beneficios.fixo.ativo ? (
              <input
                type="number"
                placeholder="Valor (R$)"
                value={beneficios.fixo.valor || ''}
                onChange={(e) =>
                  setBeneficios({ ...beneficios, fixo: { ...beneficios.fixo, valor: parseFloat(e.target.value) || 0 } })
                }
                className="w-32 rounded-lg border border-gray-200 p-2 text-sm"
              />
            ) : null}
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={beneficios.extra.ativo}
              onChange={(e) => setBeneficios({ ...beneficios, extra: { ...beneficios.extra, ativo: e.target.checked } })}
              className="mt-2"
            />
            <div className="flex-1">
              <span className="text-sm">Benefício extra</span>
              {beneficios.extra.ativo ? (
                <textarea
                  placeholder="Descreva o benefício extra…"
                  value={beneficios.extra.texto}
                  onChange={(e) => setBeneficios({ ...beneficios, extra: { ...beneficios.extra, texto: e.target.value } })}
                  className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
                  rows={2}
                />
              ) : null}
            </div>
          </div>

          <div>
            <label className="font-medium text-gray-800">Válido até</label>
            <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" />
          </div>

          <button type="button" onClick={() => void handleSubmit()} className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-bold text-white">
            CADASTRAR OFERTA
          </button>
        </div>
      ) : null}

      {msg ? <p className="text-sm text-[#0097b2]">{msg}</p> : null}

      {carregando ? <p className="text-sm text-gray-400">Carregando ofertas…</p> : null}

      {!carregando && ofertas.length > 0 ? (
        <div>
          <h3 className="mb-3 font-medium text-gray-800">📋 Ofertas cadastradas</h3>
          <ul className="space-y-2">
            {ofertas.map((oferta) => {
              const raw = oferta.beneficios
              const b =
                raw && typeof raw === 'object' && !Array.isArray(raw)
                  ? /** @type {Record<string, { ativo?: boolean; valor?: number; texto?: string }>} */ (raw)
                  : {}
              const pax = b.pax
              const pct = b.percentual
              const fix = b.fixo
              const ex = b.extra
              return (
                <li key={String(oferta.id)} className="rounded-lg border border-gray-100 p-3">
                  <div className="font-bold text-gray-900">{String(oferta.categoria_profissional)}</div>
                  <div className="text-sm text-gray-600">
                    {pax?.ativo ? `✅ PAX: R$ ${pax.valor ?? 0} · ` : ''}
                    {pct?.ativo ? `% venda: ${pct.valor ?? 0}% · ` : ''}
                    {fix?.ativo ? `Indicação: R$ ${fix.valor ?? 0} · ` : ''}
                    {ex?.ativo && ex.texto ? `✨ ${String(ex.texto).slice(0, 50)}` : ''}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    📅 Válido até {oferta.data_validade ? new Date(String(oferta.data_validade)).toLocaleDateString('pt-BR') : '—'} · {String(oferta.status ?? '')}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
