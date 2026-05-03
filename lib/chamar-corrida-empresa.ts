const DIAS_SEM = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const

/** Nome do dia para textos ao utilizador (ex.: aviso de corrida). */
const NOME_DIA_LONGO: Record<(typeof DIAS_SEM)[number], string> = {
  domingo: 'Domingo',
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
}

type Slot = {
  fechado: boolean
  abre: string
  fecha: string
  pausa_almoco: boolean
  almoco_inicio: string
  almoco_fim: string
}

function horaAgoraHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function parseSlot(raw: unknown): Slot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  return {
    fechado: Boolean(o.fechado),
    abre: String(o.abre ?? '').trim(),
    fecha: String(o.fecha ?? '').trim(),
    pausa_almoco: Boolean(o.pausa_almoco),
    almoco_inicio: String(o.almoco_inicio ?? '').trim(),
    almoco_fim: String(o.almoco_fim ?? '').trim(),
  }
}

/** Minutos de `a` até `b` no mesmo dia (HH:MM). */
function minutosAte(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  if (!Number.isFinite(ah) || !Number.isFinite(am) || !Number.isFinite(bh) || !Number.isFinite(bm)) return 99999
  return bh * 60 + bm - (ah * 60 + am)
}

/**
 * Descreve apenas o horário do dia atual (para avisos curtos).
 */
export function formatarHorarioSomenteHoje(
  horarios: Record<string, unknown> | null | undefined,
  ref: Date = new Date()
): string {
  const dia = DIAS_SEM[ref.getDay()]
  const nome = NOME_DIA_LONGO[dia]
  if (!horarios || typeof horarios !== 'object') {
    return `Horário de funcionamento HOJE (${nome}): sem registo.`
  }
  const slot = parseSlot(horarios[dia])
  if (!slot) {
    return `Horário de funcionamento HOJE (${nome}): sem configuração.`
  }
  if (slot.fechado) {
    return `Horário de funcionamento HOJE (${nome}): Fechado.`
  }
  if (!slot.abre || !slot.fecha) {
    return `Horário de funcionamento HOJE (${nome}): incompleto.`
  }
  return `Horário de funcionamento HOJE (${nome}): ${slot.abre} – ${slot.fecha}.`
}

/** @deprecated Preferir formatarHorarioSomenteHoje — mantido por compatibilidade. */
export function formatarResumoHorarios(horarios: Record<string, unknown> | null | undefined): string {
  return formatarHorarioSomenteHoje(horarios)
}

export type AvisoCorrida =
  | { irDireto: true }
  | { irDireto: false; titulo: string; mensagem: string }

/**
 * Decide se deve mostrar confirmação antes de /mobilidade?destino_empresa=…
 */
export function avaliarAvisoChamarCorrida(horarios: Record<string, unknown> | null | undefined): AvisoCorrida {
  const hoje = new Date()
  const linhaHoje = formatarHorarioSomenteHoje(horarios, hoje)
  const dia = DIAS_SEM[hoje.getDay()]
  const agora = horaAgoraHHMM()
  const slot = horarios && typeof horarios === 'object' ? parseSlot(horarios[dia]) : null

  if (!slot) {
    return {
      irDireto: false,
      titulo: 'Horário',
      mensagem: `Empresa está fechada hoje.\n${linhaHoje}\nDeseja mesmo assim chamar a corrida?`,
    }
  }

  if (slot.fechado) {
    return {
      irDireto: false,
      titulo: 'Fechado',
      mensagem: `Empresa está fechada hoje.\n${linhaHoje}\nDeseja mesmo assim chamar a corrida?`,
    }
  }

  if (!slot.abre || !slot.fecha) {
    return {
      irDireto: false,
      titulo: 'Horário',
      mensagem: `Empresa está fechada hoje.\n${linhaHoje}\nDeseja mesmo assim chamar a corrida?`,
    }
  }

  if (agora < slot.abre) {
    const min = minutosAte(agora, slot.abre)
    if (min > 0 && min <= 60) {
      return {
        irDireto: false,
        titulo: 'Abre em breve',
        mensagem: `Empresa abre hoje às ${slot.abre}.\nDeseja chamar a corrida agora?`,
      }
    }
    return { irDireto: true }
  }

  if (agora > slot.fecha) {
    return {
      irDireto: false,
      titulo: 'Fechado',
      mensagem: `Empresa está fechada agora (o expediente de hoje já terminou).\n${linhaHoje}\nDeseja mesmo assim chamar a corrida?`,
    }
  }

  if (slot.pausa_almoco && slot.almoco_inicio && slot.almoco_fim && agora >= slot.almoco_inicio && agora < slot.almoco_fim) {
    return {
      irDireto: false,
      titulo: 'Pausa ao almoço',
      mensagem: `Empresa está em pausa para o almoço (hoje das ${slot.almoco_inicio} às ${slot.almoco_fim}).\n${linhaHoje}\nDeseja mesmo assim chamar a corrida?`,
    }
  }

  return { irDireto: true }
}
