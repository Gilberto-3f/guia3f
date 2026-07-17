'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { contarCliquesBotaoDinamicoMes } from '@/lib/botaoDinamicoCliques'
import { cidadeEhCiudadDelEste, cidadeEhFozOuPuertoIguazu, empresaEhSegmentoLojasParaguai } from '@/lib/cidade-empresa'
import { getRotuloAbaServico } from '@/lib/empresaCategoria'
import AbaAcomodacoes from './hospedagem/AbaAcomodacoes'
import AbaInformacoes from './hospedagem/AbaInformacoes'
import AbaAtrativos from './atrativos/AbaAtrativos'
import AbaInformacoesAtrativos from './atrativos/AbaInformacoesAtrativos'
import AbaProdutos from './compras-cde/AbaProdutos'
import AbaContatos from './compras-cde/AbaContatos'

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
  if (isPasseios(categoria)) return 'Comprar Ticket'
  if (isHospedagem(categoria)) return 'FAZER RESERVA'
  if (isServicosLocais(categoria)) return 'WhatsApp'
  if (isLojas(categoria)) {
    if (cidadeEhCiudadDelEste(cidade)) return 'Catálogo'
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
    return 'Cadastre experiências (tickets) e políticas. Cada atrativo tem título, fotos, descrição e preços.'
  }
  if (isHospedagem(categoria)) {
    return 'Cadastre acomodações e políticas da casa. O preço fica por acomodação.'
  }
  if (isServicosLocais(categoria)) {
    return 'O botão abre conversa no WhatsApp da empresa.'
  }
  if (isLojas(categoria) && cidadeEhCiudadDelEste(cidade)) {
    return 'Cadastre produtos (USD) e o WhatsApp comercial. O botão Catálogo abre o catálogo no Compras CDE.'
  }
  if (isLojas(categoria) && cidadeEhFozOuPuertoIguazu(cidade)) {
    return 'Em Foz ou Puerto Iguazú o botão chama corrida na Mobilidade.'
  }
  if (isEventos(categoria)) {
    return 'Configure preços de ingresso e WhatsApp para vendas.'
  }
  return 'Personalize as informações usadas pelo botão na sua página e no guia.'
}

function abaVerdeCls(ativa: boolean) {
  return `flex-1 rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition-colors sm:text-sm ${
    ativa ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`
}

export default function ConfigBotaoDinamico() {
  const { dados, refetch } = useDashboardEmpresa()
  const empresaId = dados?.id != null ? String(dados.id) : ''
  const categoria = dados?.categoria != null ? String(dados.categoria) : ''
  const cidade = dados?.cidade != null ? String(dados.cidade) : ''
  const ehHospedagem = isHospedagem(categoria) || Boolean(dados?.somente_anfitriao)

  const [whatsapp, setWhatsapp] = useState('')
  const [ticketInteira, setTicketInteira] = useState('')
  const [ticketMeia, setTicketMeia] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [cliquesMes, setCliquesMes] = useState<number | null>(null)
  const [infoAberto, setInfoAberto] = useState(false)
  const [abaHospedagem, setAbaHospedagem] = useState<'acomodacoes' | 'informacoes'>('acomodacoes')
  const [abaAtrativos, setAbaAtrativos] = useState<'atrativos' | 'informacoes'>('atrativos')
  const [abaComprasCde, setAbaComprasCde] = useState<'produtos' | 'contatos'>('produtos')
  const ehAtrativos = isPasseios(categoria)
  const ehLojasCde = empresaEhSegmentoLojasParaguai(categoria, cidade)

  const rotuloAba = getRotuloAbaServico(categoria)
  const textoBotao = useMemo(() => textoBotaoPreview(categoria, cidade), [categoria, cidade])
  const descricao = useMemo(() => descricaoSegmento(categoria, cidade), [categoria, cidade])

  const precisaWhatsapp =
    isGastronomia(categoria) ||
    isServicosLocais(categoria) ||
    isEventos(categoria)
  const precisaTickets = isEventos(categoria)

  useEffect(() => {
    if (!dados) return
    setWhatsapp(dados.whatsapp != null ? String(dados.whatsapp) : '')
    setTicketInteira(
      dados.preco_ticket_inteira != null ? String(dados.preco_ticket_inteira) : '',
    )
    setTicketMeia(dados.preco_ticket_meia != null ? String(dados.preco_ticket_meia) : '')
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
      if (precisaWhatsapp || ehAtrativos) {
        payload.whatsapp = whatsapp.trim() || null
      }
      if (precisaTickets) {
        payload.preco_ticket_inteira = asNumberOrNull(ticketInteira)
        payload.preco_ticket_meia = asNumberOrNull(ticketMeia)
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

  const desempenhoCard = (
    <div className="rounded-xl border border-gray-200 bg-[#f5f5f5] p-4">
      <div className="flex items-center gap-2 text-[#001f3f]">
        <BarChart3 className="h-5 w-5 text-[#0097b2]" aria-hidden />
        <h2 className="text-sm font-bold">Desempenho no mês</h2>
      </div>
      <p className="mt-2 text-3xl font-bold text-[#0097b2]">
        {cliquesMes == null ? '—' : cliquesMes}
      </p>
      <p className="mt-1 text-xs text-gray-600">
        {ehHospedagem
          ? 'Aberturas do drawer de reservas (mês corrente)'
          : 'Cliques no botão dinâmico (mês corrente)'}
      </p>
    </div>
  )

  if (ehHospedagem && empresaId) {
    return (
      <div className="mt-4 space-y-4">
        <div className="flex gap-2" role="tablist" aria-label="Seções do botão dinâmico">
          <button
            type="button"
            role="tab"
            aria-selected={abaHospedagem === 'acomodacoes'}
            className={abaVerdeCls(abaHospedagem === 'acomodacoes')}
            onClick={() => setAbaHospedagem('acomodacoes')}
          >
            Acomodações
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaHospedagem === 'informacoes'}
            className={abaVerdeCls(abaHospedagem === 'informacoes')}
            onClick={() => setAbaHospedagem('informacoes')}
          >
            Informações
          </button>
        </div>

        {abaHospedagem === 'acomodacoes' ? (
          <AbaAcomodacoes empresaId={empresaId} />
        ) : (
          <div className="space-y-4">
            <AbaInformacoes empresaId={empresaId} />
            {desempenhoCard}
          </div>
        )}
      </div>
    )
  }

  if (ehLojasCde && empresaId) {
    return (
      <div className="mt-4 space-y-4">
        <div className="flex gap-2" role="tablist" aria-label="Seções do botão dinâmico">
          <button
            type="button"
            role="tab"
            aria-selected={abaComprasCde === 'produtos'}
            className={abaVerdeCls(abaComprasCde === 'produtos')}
            onClick={() => setAbaComprasCde('produtos')}
          >
            Produtos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaComprasCde === 'contatos'}
            className={abaVerdeCls(abaComprasCde === 'contatos')}
            onClick={() => setAbaComprasCde('contatos')}
          >
            Contatos
          </button>
        </div>

        {abaComprasCde === 'produtos' ? (
          <AbaProdutos empresaId={empresaId} />
        ) : (
          <AbaContatos
            empresaId={empresaId}
            whatsappGeral={dados?.whatsapp != null ? String(dados.whatsapp) : null}
            whatsappComercialInicial={
              dados?.whatsapp_comercial != null ? String(dados.whatsapp_comercial) : null
            }
            onSalvo={() => void refetch()}
          />
        )}
      </div>
    )
  }

  if (ehAtrativos && empresaId) {
    return (
      <div className="mt-4 space-y-4">
        <div className="flex gap-2" role="tablist" aria-label="Seções do botão dinâmico">
          <button
            type="button"
            role="tab"
            aria-selected={abaAtrativos === 'atrativos'}
            className={abaVerdeCls(abaAtrativos === 'atrativos')}
            onClick={() => setAbaAtrativos('atrativos')}
          >
            Atrativos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaAtrativos === 'informacoes'}
            className={abaVerdeCls(abaAtrativos === 'informacoes')}
            onClick={() => setAbaAtrativos('informacoes')}
          >
            Informações
          </button>
        </div>

        {abaAtrativos === 'atrativos' ? (
          <AbaAtrativos empresaId={empresaId} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <label className={labelCls}>
                WhatsApp (envio do comprovante)
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="55 45 99999-9999"
                  className={inputCls}
                />
              </label>
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={salvando || !empresaId}
                className="mt-3 w-full rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Salvar WhatsApp'}
              </button>
              {msg ? (
                <p
                  className={`mt-2 text-sm ${msg.includes('salvas') ? 'text-emerald-700' : 'text-rose-600'}`}
                >
                  {msg}
                </p>
              ) : null}
            </div>
            <AbaInformacoesAtrativos empresaId={empresaId} />
            {desempenhoCard}
          </div>
        )}
      </div>
    )
  }

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

          {!precisaWhatsapp && !precisaTickets ? (
            <p className="text-sm text-gray-600">
              Para o seu segmento não há campos extras — o botão usa a lógica padrão do guia com os dados da sua
              página.
            </p>
          ) : null}
        </div>

        {msg ? (
          <p className={`mt-4 text-sm ${msg.includes('salvas') ? 'text-emerald-700' : 'text-rose-600'}`}>{msg}</p>
        ) : null}

        {precisaWhatsapp || precisaTickets ? (
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || !empresaId}
            className="mt-5 w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar configuração'}
          </button>
        ) : null}
      </div>

      {desempenhoCard}
    </div>
  )
}
