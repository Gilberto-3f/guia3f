/** Intervalos HTTP da Mobilidade — um poll por papel, backoff quando ocioso. */

/** Corrida ao vivo (status + GPS no mapa). */
export const MOBILIDADE_POLL_CORRIDA_ATIVA_MS = 20_000
/** Sem corrida: só detectar aceite / nova oferta. */
export const MOBILIDADE_POLL_CORRIDA_IDLE_MS = 5_000
/** Ofertas / agendamentos pendentes (profissional livre). */
export const MOBILIDADE_POLL_OFERTA_IDLE_MS = 3_000
/** Popup verde de conclusão aberto. */
export const MOBILIDADE_POLL_CONCLUSAO_ATIVA_MS = 8_000
/** Sem conclusão pendente. */
export const MOBILIDADE_POLL_CONCLUSAO_IDLE_MS = 30_000
/** Chat da corrida. */
export const MOBILIDADE_POLL_CHAT_MS = 8_000
/** Espera de matching no popup. */
export const MOBILIDADE_POLL_MATCHING_MS = 5_000
/** GPS local: detectar chegada na partida. */
export const MOBILIDADE_POLL_CHEGADA_GPS_MS = 15_000
