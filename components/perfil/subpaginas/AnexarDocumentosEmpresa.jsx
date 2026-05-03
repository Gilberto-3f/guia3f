'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,application/pdf'

/**
 * @param {File} file
 */
function validarArquivo(file) {
  if (!file || file.size === 0) return 'Selecione um arquivo.'
  if (file.size > MAX_BYTES) return 'Arquivo acima de 5 MB.'
  const ok =
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'application/pdf' ||
    /\.pdf$/i.test(file.name)
  if (!ok) return 'Use JPG, PNG ou PDF.'
  return ''
}

/**
 * @param {File} file
 * @param {string} userId
 * @param {string} empresaId
 * @param {string} rotulo
 */
async function uploadEmpresaDoc(file, userId, empresaId, rotulo) {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `documentos/${userId}/empresa-${empresaId}-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('documentos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('documentos').getPublicUrl(path)
  return data.publicUrl
}

/**
 * @param {{ empresaId: string | null, usuarioId: string | null, categoria?: string | null, onConcluido?: () => void }} props
 */
export default function AnexarDocumentosEmpresa({ empresaId, usuarioId, categoria, onConcluido }) {
  const [frente, setFrente] = useState(/** @type {File | null} */ (null))
  const [verso, setVerso] = useState(/** @type {File | null} */ (null))
  const [residencia, setResidencia] = useState(/** @type {File | null} */ (null))
  const [comercial, setComercial] = useState(/** @type {File | null} */ (null))
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const catLabel = categoria != null && String(categoria).trim() !== '' ? String(categoria).trim() : 'sua categoria'

  const onChange =
    (setter) =>
    /** @param {React.ChangeEvent<HTMLInputElement>} */ (e) => {
      const f = e.target.files?.[0] ?? null
      setErro('')
      setOkMsg('')
      if (!f) {
        setter(null)
        return
      }
      const v = validarArquivo(f)
      if (v) {
        setErro(v)
        setter(null)
        e.target.value = ''
        return
      }
      setter(f)
    }

  const enviar = useCallback(async () => {
    setErro('')
    setOkMsg('')
    if (!usuarioId || !empresaId) {
      setErro('Sessão inválida.')
      return
    }
    if (!frente || !verso || !residencia || !comercial) {
      setErro('Envie os quatro documentos obrigatórios.')
      return
    }
    for (const pair of [
      [frente, 'frente'],
      [verso, 'verso'],
      [residencia, 'residencia'],
      [comercial, 'comercial'],
    ]) {
      const v = validarArquivo(/** @type {File} */ (pair[0]))
      if (v) {
        setErro(v)
        return
      }
    }

    setEnviando(true)
    try {
      const [uF, uV, uR, uC] = await Promise.all([
        uploadEmpresaDoc(frente, usuarioId, empresaId, 'id-frente'),
        uploadEmpresaDoc(verso, usuarioId, empresaId, 'id-verso'),
        uploadEmpresaDoc(residencia, usuarioId, empresaId, 'residencia'),
        uploadEmpresaDoc(comercial, usuarioId, empresaId, 'doc-categoria'),
      ])

      const agora = new Date().toISOString()
      const { error: upErr } = await supabase
        .from('empresas')
        .update({
          documento_frente_url: uF,
          documento_verso_url: uV,
          comprovante_residencia_url: uR,
          documento_comercial_url: uC,
          documentos_enviados_em: agora,
        })
        .eq('id', empresaId)
        .eq('usuario_id', usuarioId)

      if (upErr) throw new Error(upErr.message)

      setOkMsg('Documentos enviados com sucesso! Aguarde a análise do administrador.')
      try {
        window.dispatchEvent(new Event('perfil-atualizado'))
      } catch {
        /* ignore */
      }
      onConcluido?.()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.')
    } finally {
      setEnviando(false)
    }
  }, [usuarioId, empresaId, frente, verso, residencia, comercial, onConcluido])

  const inputCls =
    'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 file:mr-3 file:rounded-md file:border-0 file:bg-[#0097b2] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white'

  return (
    <div className="space-y-5 text-gray-900">
      <div>
        <h2 className="text-lg font-bold text-[#001f3f]">Anexar documentos</h2>
        <p className="mt-1 text-sm leading-snug text-gray-600">
          Envie a documentação da empresa na categoria <span className="font-semibold text-gray-800">{catLabel}</span>:
          identidade do representante legal (frente e verso), comprovante de residência e documento comercial ou de
          atividade (alvará, cartão CNPJ, contrato social ou equivalente). Formatos: JPG, PNG ou PDF. Máximo 5 MB por
          arquivo.
        </p>
      </div>

      {erro ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</div> : null}
      {okMsg ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{okMsg}</div> : null}

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-800">
          Documento de identidade do representante (frente)
          <input type="file" accept={ACCEPT} className={`mt-1 ${inputCls}`} onChange={onChange(setFrente)} />
        </label>
        <label className="block text-sm font-semibold text-gray-800">
          Documento de identidade do representante (verso)
          <input type="file" accept={ACCEPT} className={`mt-1 ${inputCls}`} onChange={onChange(setVerso)} />
        </label>
        <label className="block text-sm font-semibold text-gray-800">
          Comprovante de residência
          <input type="file" accept={ACCEPT} className={`mt-1 ${inputCls}`} onChange={onChange(setResidencia)} />
        </label>
        <label className="block text-sm font-semibold text-gray-800">
          Documento comercial / da categoria
          <input type="file" accept={ACCEPT} className={`mt-1 ${inputCls}`} onChange={onChange(setComercial)} />
        </label>
      </div>

      <button
        type="button"
        disabled={enviando}
        onClick={() => void enviar()}
        className="w-full rounded-xl py-3 text-base font-bold text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
        style={{ backgroundColor: '#00D443' }}
      >
        {enviando ? 'Enviando…' : 'ENVIAR PARA ANÁLISE'}
      </button>
    </div>
  )
}
