'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { contarCliquesBotaoDinamicoMes } from '@/lib/botaoDinamicoCliques'
import { cidadeEhCiudadDelEste, cidadeEhFozOuPuertoIguazu } from '@/lib/cidade-empresa'
import { getRotuloAbaServico } from '@/lib/empresaCategoria'

function asNumberOrNull(v: string) {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function isGastronomia(cat: string) {
  const c = cat.toLowerCase()
  return c === 'restaurantes' || c === 'gastronomia'
}

function isPasseios(cat: string) {
  const c = cat.toLowerCase()
  return c === 'atrativos' || c === 'passeios'
}

function isHospedagem(cat: string) {
  const c = cat.toLowerCase()
  return c === 'hospedagem'
}

function isServicosLocais(cat: string) {
  const c = cat.toLowerCase()
  return c === 'servicos_locais' || c === 'serviços locais' || c === 'servicos locais'
}

function isLojas(cat: string) {
  const c = cat.toLowerCase()
  return c === 'lojas'
}

function isEventos(cat: string) {
  const c = cat.toLowerCase()
  return c === 'eventos'
}

function textoBotaoPreview(categoria: string, cidade: string) {
  if (isGastronomia(categoria)) return 'RESERVAR MESA'
  if (isPasseios(categoria)) return 'TIKETS'
  if (isHospedagem(categoria)) return 'FAZER RESERVA'
  if (isServicosLocais(categoria)) return 'FALAR NO WHATSAPP'
  if (isLojas(categoria)) {
    if (cidadeEhCiudadDelEste(cidade)) return 'VER PRODUTOS'
    if (cidadeEhFozOuPuertoIguazu(cidade)) return 'CHAMAR CORRIDA'
  }
  if (isEventos(categoria)) return 'COMPRAR INGRESSO'
  return 'VER MAIS'
}

function descricaoSegmento(categoria: string, cidade: string) {
  if (isGastronomia(categoria)) {
    return 'Visitantes reservam mesa pelo WhatsApp. Configure o número com DDD.'
  }
  if (isPasseios(categoria)) {
    return 'Defina os preços dos tickets (inteira e meia) exibidos no popup de compra.'
  }
  if (isHospedagem(categoria)) {
    return 'Informe o preço da diária e o WhatsApp para reservas de quarto.'
  }
  if (isServicosLocais(categoria)) {
    return 'O botão abre conversa no WhatsApp da empresa.'
  }
  if (isLojas(categoria) && cidadeEhCiudadDelEste(cidade)) {
    return 'Em Ciudad del Este o botão leva à vitrine de produtos (Compras Paraguai).'
  }
  if (isLojas(categoria) && cidadeEhFozOuPuertoIguazu(cidade)) {
    return 'Em Foz ou Puerto Iguazú o botão chama corrida na Mobilidade.'
  }
  if (isEventos(categoria)) {
    return 'Configure preços de ingresso e WhatsApp para vendas.'
  }
  return 'Personalize as informações usadas pelo botão na sua página e no guia.'
}

export default function ConfigBotaoDinamico() {
  const { dados, refetch } = useDashboardEmpresa()
  const empresaId = dados?.id != null ? String(dados.id) : ''
  const categoria = dados?.categoria != null ? String(dados.categoria) : ''
  const cidade = dados?.cidade != null ? String(dados.cidade) : ''

  const [whatsapp, setWhatsapp] = useState('')
  const [ticketInteira, setTicketInteira] = useState('')
  const [ticketMeia, setTicketMeia] = useState('')
  const [precoDiaria, setPrecoDiaria] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [cliquesMes, setCliquesMes] = useState<number | null>(null)
  const [infoAberto, setInfoAberto] = useState(false)

  const rotuloAba = getRotuloAbaServico(categoria)
  const textoBotao = useMemo(() => textoBotaoPreview(categoria, cidade), [categoria, cidade])
  const descricao = useMemo(() => descricaoSegmento(categoria, cidade), [categoria, cidade])

  const precisaWhatsapp =
    isGastronomia(categoria) ||
    isHospedagem(categoria) ||
    isServicosLocais(categoria) ||
    isPasseios(categoria) ||
    isEventos(categoria)
  const precisaTickets = isPasseios(categoria) || isEventos(categoria)
  const precisaDiaria = isHospedagem(categoria)

  useEffect(() => {
    if (!dados) return
    setWhatsapp(dados.whatsapp != null ? String(dados.whatsapp) : '')
    setTicketInteira(
      dados.preco_ticket_inteira != null ? String(dados.preco_ticket_inteira) : '',
    )
    setTicketMeia(dados.preco_ticket_meia != null ? String(dados.preco_ticket_meia) : '')
    setPrecoDiaria(dados.preco_diaria != null ? String(dados.preco_diaria) : '')
  }, [dados])

  const carregarCliques = useCallback(async () => {
    if (!empresaId) return
    const total = await contarCliquesBotaoDinamicoMes(supabase, empresaId)
    setCliquesMes(total)
  }, [empresaId])

  useEffect(() => {
    void carregarCliques()
  }, [carregarCliques])

  const salvar = async () => {
    if (!empresaId) return
    setSalvando(true)
    setMsg(null)
    try {
      const payload: Record<string, unknown> = {}
      if (precisaWhatsapp) {
        payload.whatsapp = whatsapp.trim() || null
      }
      if (precisaTickets) {
        payload.preco_ticket_inteira = asNumberOrNull(ticketInteira)
        payload.preco_ticket_meia = asNumberOrNull(ticketMeia)
      }
      if (precisaDiaria) {
        payload.preco_diaria = asNumberOrNull(precoDiaria)
      }

      const { error } = await supabase.from('empresas').update(payload).eq('id', empresaId)
      if (error) throw error

      setMsg('Configurações salvas.')
      await refetch()
      window.dispatchEvent(new Event('perfil-atualizado'))
    } catch (e) {
      const texto = e instanceof Error ? e.message : 'Não foi possível salvar.'
      setMsg(texto)
    } finally {
      setSalvando(false)
    }
  }

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500'

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0097b2]">Pré-visualização</p>
            <p className="mt-1 text-sm text-gray-600">
              Aba na página: <span className="font-semibold text-gray-900">{rotuloAba}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInfoAberto((v) => !v)}
            className="shrink-0 rounded-full p-1 text-[#0097b2] hover:bg-[#0097b2]/10"
            aria-label="Informação sobre o botão dinâmico"
            aria-expanded={infoAberto}
          >
            <Info className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {infoAberto ? <p className="mt-3 text-sm leading-relaxed text-gray-600">{descricao}</p> : null}
        <button
          type="button"
          disabled
          className="mt-4 w-full rounded-lg bg-[#00D443] py-3 text-sm font-bold text-white opacity-95"
        >
          {textoBotao}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#001f3f]">Configuração</h2>
        <p className="mt-1 text-xs text-gray-500">{descricao}</p>

        <div className="mt-4 space-y-4">
          {precisaWhatsapp ? (
            <label className={labelCls}>
              WhatsApp
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="55 45 99999-9999"
                className={inputCls}
              />
            </label>
          ) : null}

          {precisaTickets ? (
            <>
              <label className={labelCls}>
                Ticket inteira (R$)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={ticketInteira}
                  onChange={(e) => setTicketInteira(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                Ticket meia (R$)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={ticketMeia}
                  onChange={(e) => setTicketMeia(e.target.value)}
                  className={inputCls}
                />
              </label>
            </>
          ) : null}

          {precisaDiaria ? (
            <label className={labelCls}>
              Diária (R$)
              <input
                type="number"
                min={0}
                step={0.01}
                value={precoDiaria}
                onChange={(e) => setPrecoDiaria(e.target.value)}
                className={inputCls}
              />
            </label>
          ) : null}

          {!precisaWhatsapp && !precisaTickets && !precisaDiaria ? (
            <p className="text-sm text-gray-600">
              Para o seu segmento não há campos extras — o botão usa a lógica padrão do guia com os dados da sua
              página.
            </p>
          ) : null}
        </div>

        {msg ? (
          <p className={`mt-4 text-sm ${msg.includes('salvas') ? 'text-emerald-700' : 'text-rose-600'}`}>{msg}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando || !empresaId}
          className="mt-5 w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar configuração'}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-[#f5f5f5] p-4">
        <div className="flex items-center gap-2 text-[#001f3f]">
          <BarChart3 className="h-5 w-5 text-[#0097b2]" aria-hidden />
          <h2 className="text-sm font-bold">Desempenho no mês</h2>
        </div>
        <p className="mt-2 text-3xl font-bold text-[#0097b2]">
          {cliquesMes == null ? '—' : cliquesMes}
        </p>
        <p className="mt-1 text-xs text-gray-600">Cliques no botão dinâmico (mês corrente)</p>
      </div>
    </div>
  )
}
