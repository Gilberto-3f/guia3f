'use client'

import CanalFinanceiroUsuario from '@/components/CanalFinanceiroUsuario'

/**
 * @param {{ usuarioId: string, tipo: 'profissional' | 'empresa' }} props
 */
export default function CanalFinanceiroLista(props) {
  return <CanalFinanceiroUsuario {...props} />
}
