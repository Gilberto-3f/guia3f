export const ROTULO_ABA_SERVICO: Record<string, string> = {
  Restaurantes: 'Reservar',
  Atrativos: 'Tickets',
  Lojas: 'Produtos',
  Hospedagem: 'Reservar',
  'Compras Paraguai': 'Ofertas',
  Eventos: 'Ingressos',
  Mobilidade: 'Serviços',
}

export function getRotuloAbaServico(categoria: string) {
  return ROTULO_ABA_SERVICO[categoria] || 'Serviços'
}

