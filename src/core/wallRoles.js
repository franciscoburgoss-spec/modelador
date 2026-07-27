// Vocabulario mínimo compartido por el contrato de tipos y el catálogo de reglas. Este módulo no
// conoce modelos ni findings, para evitar un ciclo domainRules → wallTypes → domainFindings.

export const WALL_ROLES = Object.freeze(['MP1', 'MP2', 'MP3', 'tabique']);

export function isWallRole(role) {
  return WALL_ROLES.includes(role);
}

/** Sólo el revestimiento inequívocamente no estructural admite girar la hebra de la placa. */
export function wallRoleAllowsOsbRotation(role) {
  if (role == null) return false;
  if (!isWallRole(role)) throw new TypeError(`Role de muro inválido: ${role}.`);
  return role === 'tabique';
}
