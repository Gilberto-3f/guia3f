const DIAS_SEM = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const

const LABEL_DIA: Record<string, string> = {
  domingo: 'Dom',
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
  sabado: 'Sáb',
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
 * Texto compacto dos horários para avisos (ex.: "Seg: 09:00–18:00; Ter: …").
 */
export function formatarResumoHorarios(horarios: Record<string, unknown> | null | undefined): string {
  if (!horarios || typeof horarios !== 'object') return 'sem horários registados'
  const partes: string[] = []
  for (const k of DIAS_SEM) {
    const s = parseSlot(horarios[k])
    if (!s) continue
    const lb = LABEL_DIA[k] ?? k
    if (s.fechado) partes.push(`${lb}: fechado`)
    else if (s.abre && s.fecha) partes.push(`${lb}: ${s.abre}–${s.fecha}`)
  }
  return partes.length ? partes.join('; ') : 'sem horários registados'
}

export type AvisoCorrida =
  | { irDireto: true }
  | { irDireto: false; titulo: string; mensagem: string }

/**
 * Decide se deve mostrar confirmação antes de /mobilidade?destino_empresa=…
 */
export function avaliarAvisoChamarCorrida(horarios: Record<string, unknown> | null | undefined): AvisoCorrida {
  const resumo = formatarResumoHorarios(horarios)
  const dia = DIAS_SEM[new Date().getDay()]
  const agora = horaAgoraHHMM()
  const slot = horarios && typeof horarios === 'object' ? parseSlot(horarios[dia]) : null

  if (!slot) {
    return {
      irDireto: false,
      titulo: 'Horário',
      mensagem: `Empresa está fechada agora (sem horário configurado para hoje). O horário de funcionamento é ${resumo}. Deseja mesmo assim chamar a corrida?`,
    }
  }

  if (slot.fechado) {
    return {
      irDireto: false,
      titulo: 'Fechado',
      mensagem: `Empresa está fechada agora. O horário de funcionamento é ${resumo}. Deseja mesmo assim chamar a corrida?`,
    }
  }

  if (!slot.abre || !slot.fecha) {
    return {
      irDireto: false,
      titulo: 'Horário',
      mensagem: `Horário incompleto para hoje. O horário de funcionamento é ${resumo}. Deseja mesmo assim chamar a corrida?`,
    }
  }

  if (agora < slot.abre) {
    const min = minutosAte(agora, slot.abre)
    if (min > 0 && min <= 60) {
      return {
        irDireto: false,
        titulo: 'Abre em breve',
        mensagem: `Empresa abre em ${min} minuto(s). O horário de funcionamento é ${resumo}. Deseja chamar corrida agora?`,
      }
    }
    return { irDireto: true }
  }

  if (agora > slot.fecha) {
    return {
      irDireto: false,
      titulo: 'Fechado',
      mensagem: `Empresa está fechada agora (já passou do horário de encerramento). O horário de funcionamento é ${resumo}. Deseja mesmo assim chamar a corrida?`,
    }
  }

  if (slot.pausa_almoco && slot.almoco_inicio && slot.almoco_fim && agora >= slot.almoco_inicio && agora < slot.almoco_fim) {
    return {
      irDireto: false,
      titulo: 'Pausa ao almoço',
      mensagem: `Empresa está em pausa para almoço (${slot.almoco_inicio}–${slot.almoco_fim}). O horário de funcionamento é ${resumo}. Deseja mesmo assim chamar a corrida?`,
    }
  }

  return { irDireto: true }
}
