'use client'

import { useState } from 'react'
import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'
import { ModalEditarPermissoes } from './ModalEditarPermissoes'

export function ListaAdmins() {
  const { admins, loading, removerAdmin, atualizarAdmin, isAdminGeral } = useGerenciaAdm()
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [adminEditandoId, setAdminEditandoId] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)

  if (!isAdminGeral) return null

  if (loading) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Carregando admins...</div>
  }

  if (!admins.length) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Nenhum admin cadastrado.</div>
  }

  const handleRemover = async (id: string, nome: string) => {
    if (!window.confirm(`Remover ${nome} como admin?`)) return
    setRemovendo(id)
    await removerAdmin(id)
    setRemovendo(null)
  }

  const cargoLabel = (cargo: string, comunidade: string | null) => {
    if (cargo === 'MODERADOR') return `Moderador${comunidade ? ` (${comunidade})` : ''}`
    if (cargo === 'FINANCEIRO') return 'ADM financeiro'
    if (cargo === 'AUXILIAR_ADM' || cargo === 'SUPORTE') return 'Auxiliar ADM'
    return 'ADM GERAL'
  }

  const adminEditando = adminEditandoId ? admins.find((a) => a.id === adminEditandoId) ?? null : null

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
        <div className="text-sm font-bold text-gray-900">Admins atuais</div>
        <div className="mt-3 space-y-2">
          {admins.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900">{a.nome}</div>
                <div className="text-xs text-gray-600">{a.email}</div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {cargoLabel(a.cargo, a.comunidade)} · Desde {new Date(a.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdminEditandoId(a.id)
                    setModalAberto(true)
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-700"
                >
                  ⚙️ Permissões
                </button>
                <button
                  type="button"
                  onClick={() => handleRemover(a.id, a.nome)}
                  disabled={removendo === a.id}
                  className="rounded-xl bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  {removendo === a.id ? '...' : '❌ Remover'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ModalEditarPermissoes
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        admin={adminEditando}
        onSave={async (updates) => {
          if (!adminEditando) return
          await atualizarAdmin(adminEditando.id, updates)
        }}
      />
    </>
  )
}

