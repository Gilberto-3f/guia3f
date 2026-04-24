export const ROTULO_ABA_SERVICO: Record<string, string> = {
  gastronomia: 'Reservar',
  Restaurantes: 'Reservar',
  passeios: 'Tickets',
  Atrativos: 'Tickets',
  lojas: 'Produtos',
  Lojas: 'Produtos',
  hospedagem: 'Reservar',
  Hospedagem: 'Reservar',
  'Compras Paraguai': 'Ofertas',
  eventos: 'Ingressos',
  Eventos: 'Ingressos',
  mobilidade: 'Serviços',
  Mobilidade: 'Serviços',
}

export function getRotuloAbaServico(categoria: string) {
  return ROTULO_ABA_SERVICO[categoria] || 'Serviços'
}

