'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Car, Coins, ImagePlus, Paperclip, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MOEDAS_MOBILIDADE } from '@/lib/mobilidadePopupPesquisa'
import {
  normalizarMoedaModo,
  normalizarMoedasPreferencia,
  normalizarVeiculoAno,
  normalizarVeiculoFotos,
  normalizarVeiculoLugares,
  normalizarVeiculoModelo,
  profissionalElegivelPerfilMobilidade,
  validarCadastroMobilidadeCompleto,
} from '@/lib/mobilidadePerfilProfissional'
import AnexarDocumentos from '@/components/perfil/subpaginas/AnexarDocumentos'

const COR = '#0097b2'
const VERDE = '#00D443'

function ChevronPasta({ titulo, aberto, onToggle, icon: Icon, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-3 text-left"
      >
        <Icon className="h-5 w-5 shrink-0" style={{ color: COR }} aria-hidden />
        <span
          className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wide"
          style={{ color: COR }}
        >
          {titulo}
        </span>
        <span className="text-xs text-gray-400">{aberto ? '▲' : '▼'}</span>
      </button>
      {/* Mantém montado (estado/ref) mesmo fechado — só oculta. */}
      <div className={aberto ? 'border-t border-gray-100 px-3 pb-3 pt-2' : 'hidden'}>
        {children}
      </div>
    </div>
  )
}

/**
 * Perfil Mobilidade (placa vermelha + motorista de app): veículo, moeda e documentos.
 * @param {{ usuarioId: string | null, onDocsConcluido?: () => void }} props
 */
export default function MobilidadePerfil({ usuarioId, onDocsConcluido }) {
  const docsRef = useRef(/** @type {{ enviar: () => Promise<{ ok: boolean, erro?: string }> } | null} */ (null))
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [elegivel, setElegivel] = useState(false)
  const [ehMotoristaApp, setEhMotoristaApp] = useState(false)
  const [pastaVeiculo, setPastaVeiculo] = useState(false)
  const [pastaMoeda, setPastaMoeda] = useState(false)
  const [pastaDocs, setPastaDocs] = useState(false)

  const [fotos, setFotos] = useState(/** @type {string[]} */ ([]))
  const [placa, setPlaca] = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno] = useState('')
  const [lugares, setLugares] = useState('')
  /** @type {[string, (v: string) => void]} */
  const [moedaModo, setMoedaModo] = useState('todas')
  const [moedasPref, setMoedasPref] = useState(/** @type {string[]} */ ([]))

  const carregar = useCallback(async () => {
    if (!usuarioId) return
    setCarregando(true)
    setErro('')
    try {
      const { data, error } = await supabase
        .from('profissionais')
        .select(
          'categorias, placa_vermelha, veiculo_fotos, veiculo_placa, veiculo_modelo, veiculo_ano, veiculo_lugares, moeda_modo, moedas_preferencia',
        )
        .eq('usuario_id', usuarioId)
        .maybeSingle()

      if (error) {
        const m = String(error.message ?? '')
        if (
          m.toLowerCase().includes('veiculo') ||
          m.toLowerCase().includes('moeda_modo')
        ) {
          setErro('Migration de veículo/moeda pendente no banco. Aplique o SQL e recarregue.')
          setElegivel(false)
          return
        }
        setErro(m)
        return
      }

      const placaV = Boolean(data?.placa_vermelha)
      const cats = Array.isArray(data?.categorias) ? data.categorias.map(String) : []
      const ok = profissionalElegivelPerfilMobilidade(placaV, cats)
      setElegivel(ok)
      setEhMotoristaApp(
        cats
          .map((c) => String(c).toLowerCase())
          .some((c) => c === 'motorista_app' || c.includes('motorista')),
      )
      if (!ok) return

      setFotos(normalizarVeiculoFotos(data?.veiculo_fotos))
      setPlaca(data?.veiculo_placa != null ? String(data.veiculo_placa) : '')
      setModelo(normalizarVeiculoModelo(data?.veiculo_modelo))
      const anoN = normalizarVeiculoAno(data?.veiculo_ano)
      setAno(anoN != null ? String(anoN) : '')
      const lug = normalizarVeiculoLugares(data?.veiculo_lugares)
      setLugares(lug != null ? String(lug) : '')
      setMoedaModo(normalizarMoedaModo(data?.moeda_modo))
      setMoedasPref(normalizarMoedasPreferencia(data?.moedas_preferencia))
    } finally {
      setCarregando(false)
    }
  }, [usuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const uploadFoto = async (file) => {
    if (!usuarioId || !file) return
    const ext = String(file.name ?? '').split('.').pop() || 'jpg'
    const path = `${usuarioId}/veiculo-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('fotos-perfil').upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })
    if (upErr) throw upErr
    const { data } = supabase.storage.from('fotos-perfil').getPublicUrl(path)
    const url = data?.publicUrl
    if (url) setFotos((prev) => [...prev, url].slice(0, 8))
  }

  const enviarParaAnalise = async () => {
    if (!usuarioId || enviando) return
    setEnviando(true)
    setMsg('')
    setErro('')
    try {
      const faltando = validarCadastroMobilidadeCompleto({
        fotos,
        placa,
        modelo,
        ano,
        lugares,
        moedaModo,
        moedasPreferencia: moedasPref,
      })
      if (faltando.length > 0) {
        setErro(`Campos incompletos (Veículo/Moeda): ${faltando.join(', ')}.`)
        return
      }

      const lug = /** @type {number} */ (normalizarVeiculoLugares(lugares))
      const anoN = /** @type {number} */ (normalizarVeiculoAno(ano))
      const modo = normalizarMoedaModo(moedaModo)
      const prefs = modo === 'prioridade' ? normalizarMoedasPreferencia(moedasPref) : []

      const { error: veiculoErr } = await supabase
        .from('profissionais')
        .update({
          veiculo_fotos: normalizarVeiculoFotos(fotos),
          veiculo_placa: placa.trim().toUpperCase().slice(0, 20),
          veiculo_modelo: normalizarVeiculoModelo(modelo),
          veiculo_ano: anoN,
          veiculo_lugares: lug,
          moeda_modo: modo,
          moedas_preferencia: prefs,
        })
        .eq('usuario_id', usuarioId)

      if (veiculoErr) {
        setErro(veiculoErr.message)
        return
      }

      const docs = docsRef.current
      if (!docs?.enviar) {
        setErro('Não foi possível enviar os documentos. Abra a pasta Anexar documentos e tente de novo.')
        return
      }
      const resultado = await docs.enviar()
      if (!resultado.ok) {
        setErro(resultado.erro || 'Preencha a pasta Anexar documentos.')
        return
      }

      setMsg('Cadastro enviado para análise.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return <p className="p-4 text-sm text-gray-500">Carregando…</p>
  }

  if (!elegivel) {
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-gray-600">
          Disponível para profissionais de mobilidade (placa vermelha: van, táxi ou guia) e motorista
          de app. Anfitriões de hospedagem não usam este cadastro.
        </p>
        {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {ehMotoristaApp ? (
        <div className="shrink-0 border-b border-gray-100 px-4 py-2">
          <p className="text-[11px] text-gray-400">
            Motorista de app: o atendimento ao turista segue a API do parceiro; estes dados protegem o
            ecossistema.
          </p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <ChevronPasta
          titulo="Anexar documentos"
          aberto={pastaDocs}
          onToggle={() => setPastaDocs((v) => !v)}
          icon={Paperclip}
        >
          <AnexarDocumentos
            ref={docsRef}
            usuarioId={usuarioId}
            onConcluido={onDocsConcluido}
            ocultarBotao
          />
        </ChevronPasta>

        <ChevronPasta
          titulo="Veículo"
          aberto={pastaVeiculo}
          onToggle={() => setPastaVeiculo((v) => !v)}
          icon={Car}
        >
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-gray-600">Fotos do veículo</p>
              <div className="flex flex-wrap gap-2">
                {fotos.map((url) => (
                  <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFotos((prev) => prev.filter((u) => u !== url))}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white"
                      aria-label="Remover foto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {fotos.length < 8 ? (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 text-[#0097b2] hover:bg-[#0097b2]/5">
                    <ImagePlus className="h-6 w-6" aria-hidden />
                    <span className="mt-0.5 text-[10px] font-semibold">Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) void uploadFoto(f).catch((err) => setErro(String(err.message ?? err)))
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-600">
              Placa
              <input
                type="text"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                maxLength={20}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900"
                placeholder="ABC1D23"
              />
            </label>

            <label className="block text-xs font-semibold text-gray-600">
              Modelo do veículo
              <input
                type="text"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                maxLength={80}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900"
                placeholder="Ex.: Fiat Doblo"
              />
            </label>

            <label className="block text-xs font-semibold text-gray-600">
              Ano
              <input
                type="number"
                min={1980}
                max={new Date().getFullYear() + 1}
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900"
                placeholder="Ex.: 2020"
              />
            </label>

            <label className="block text-xs font-semibold text-gray-600">
              Quantidade de lugares
              <input
                type="number"
                min={1}
                max={50}
                value={lugares}
                onChange={(e) => setLugares(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900"
                placeholder="Ex.: 4"
              />
            </label>
          </div>
        </ChevronPasta>

        <ChevronPasta
          titulo="Moeda"
          aberto={pastaMoeda}
          onToggle={() => setPastaMoeda((v) => !v)}
          icon={Coins}
        >
          <div className="space-y-3">
            <p className="text-[11px] text-gray-500">
              Preferência de recebimento em dinheiro. Não bloqueia ofertas — só altera a prioridade na
              fila.
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="moeda_modo"
                checked={moedaModo === 'todas'}
                onChange={() => setMoedaModo('todas')}
              />
              Todas (aceito qualquer moeda)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="moeda_modo"
                checked={moedaModo === 'prioridade'}
                onChange={() => setMoedaModo('prioridade')}
              />
              Prioridade
            </label>
            {moedaModo === 'prioridade' ? (
              <ul className="space-y-1.5 rounded-lg border border-[#0097b2]/30 bg-[#0097b2]/5 px-3 py-2">
                {MOEDAS_MOBILIDADE.map((m) => {
                  const checked = moedasPref.includes(m.value)
                  return (
                    <li key={m.value}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setMoedasPref((prev) =>
                              checked ? prev.filter((x) => x !== m.value) : [...prev, m.value],
                            )
                          }}
                          className="h-4 w-4 accent-[#0097b2]"
                        />
                        {m.label}
                      </label>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </ChevronPasta>

        {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}
        {msg ? (
          <p className="text-sm font-medium" style={{ color: COR }}>
            {msg}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3">
        <button
          type="button"
          disabled={enviando}
          onClick={() => void enviarParaAnalise()}
          className="w-full rounded-xl py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
          style={{ backgroundColor: VERDE }}
        >
          {enviando ? 'Enviando…' : 'Enviar para análise'}
        </button>
      </div>
    </div>
  )
}
