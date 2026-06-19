/**
 * Props de selo verificado para handles em atividades.
 * @param {{ verificado?: boolean, role?: string | null } | null | undefined} perfil
 */
export function propsHandleVerificado(perfil) {
  const role = String(perfil?.role ?? '').toLowerCase()
  return {
    verificado: Boolean(perfil?.verificado),
    verificadoTipo: role === 'empresa' ? 'empresa' : 'profissional',
  }
}

function mapProps(perfil, prefix) {
  const h = propsHandleVerificado(perfil)
  return {
    [`${prefix}Verificado`]: h.verificado,
    [`${prefix}VerificadoTipo`]: h.verificadoTipo,
  }
}

/** @param {Parameters<typeof propsHandleVerificado>[0]} perfil */
export function propsInteractor(perfil) {
  return mapProps(perfil, 'interactor')
}

/** @param {Parameters<typeof propsHandleVerificado>[0]} perfil */
export function propsDonor(perfil) {
  return mapProps(perfil, 'donor')
}

/** @param {Parameters<typeof propsHandleVerificado>[0]} perfil */
export function propsAtor(perfil) {
  return mapProps(perfil, 'ator')
}

/** @param {Parameters<typeof propsHandleVerificado>[0]} perfil */
export function propsDono(perfil) {
  return mapProps(perfil, 'dono')
}

/** @param {Parameters<typeof propsHandleVerificado>[0]} perfil */
export function propsSeguidor(perfil) {
  return mapProps(perfil, 'seguidor')
}

/** @param {Parameters<typeof propsHandleVerificado>[0]} perfil */
export function propsSeguido(perfil) {
  return mapProps(perfil, 'seguido')
}

/** @param {Parameters<typeof propsHandleVerificado>[0]} perfil */
export function propsReposter(perfil) {
  return mapProps(perfil, 'reposter')
}

/** @param {Parameters<typeof propsHandleVerificado>[0]} perfil */
export function propsOriginal(perfil) {
  return mapProps(perfil, 'original')
}
