'use client'

import CanalFinanceiroUsuario from '@/components/CanalFinanceiroUsuario'

/**
 * @param {{ usuarioId: string, tipo: 'profissional' | 'empresa', empresaHospedagemId?: string | null, ehAnfitriao?: boolean }} props
 */
export default function CanalFinanceiroLista(props) {
  return <CanalFinanceiroUsuario {...props} />
}
