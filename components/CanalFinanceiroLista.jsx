'use client'

import CanalFinanceiroUsuario from '@/components/CanalFinanceiroUsuario'

/**
 * @param {{ usuarioId: string, tipo: 'profissional' | 'empresa', empresaHospedagemId?: string | null }} props
 */
export default function CanalFinanceiroLista(props) {
  return <CanalFinanceiroUsuario {...props} />
}
