'use client'

/** Sinais da UI sob a capa: a splash só sai quando o chrome navegável está pintado. */

type Listener = () => void

const listeners = new Set<Listener>()

let shellInnerMontado = false
let homeChromePronto = false
let paginaShellPronta = false
let bootConcluido = false
let ecoCarregou = false
let modosBarraProntos = false
let barraCount = 0

function emit() {
  listeners.forEach((fn) => fn())
}

export function marcarShellInnerMontado() {
  if (shellInnerMontado) return
  shellInnerMontado = true
  emit()
}

export function marcarHomeChromePronto() {
  if (homeChromePronto) return
  homeChromePronto = true
  emit()
}

export function marcarPaginaShellPronta() {
  if (paginaShellPronta) return
  paginaShellPronta = true
  emit()
}

export function marcarBootSplash() {
  if (bootConcluido) return
  bootConcluido = true
  emit()
}

export function marcarEcoSplash() {
  if (ecoCarregou) return
  ecoCarregou = true
  emit()
}

export function marcarModosBarraProntos() {
  if (modosBarraProntos) return
  modosBarraProntos = true
  emit()
}

export function registrarBarraSplash() {
  barraCount += 1
  emit()
  return () => {
    barraCount = Math.max(0, barraCount - 1)
    emit()
  }
}

function elementoPintado(sel: string): boolean {
  if (typeof document === 'undefined') return false
  const el = document.querySelector(sel)
  if (!(el instanceof HTMLElement)) return false
  const r = el.getBoundingClientRect()
  return r.width > 8 && r.height > 8
}

/** Cabeçalho (abas), grade de botões e barra inferior com tamanho real. */
export function chromeHomePintado(): boolean {
  return (
    elementoPintado('[data-splash-cabecalho]') &&
    elementoPintado('[data-splash-grade]') &&
    elementoPintado('[data-splash-barra]')
  )
}

export function lerAppSplashUi() {
  return {
    shellInnerMontado,
    homeChromePronto,
    paginaShellPronta,
    bootConcluido,
    ecoCarregou,
    modosBarraProntos,
    barraPronta: barraCount > 0,
  }
}

export function subscribeAppSplashUi(fn: Listener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
