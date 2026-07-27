// core/naming.js
import { isWallXRun } from './elementGeometry.js';
import { isElementRef } from './elementReferences.js';

/** "X1→X3 @ Y2 (6000mm)" — ejes de inicio/término, eje fijo, y largo real */
export function getWallDisplayName(wall, grid) {
  const isXRun = isWallXRun(wall);
  const startAxis = isXRun ? grid.xAxes.find(a => a.id === wall.xStart) : grid.yAxes.find(a => a.id === wall.yStart);
  const endAxis = isXRun ? grid.xAxes.find(a => a.id === wall.xEnd) : grid.yAxes.find(a => a.id === wall.yEnd);
  const fixedAxis = isXRun ? grid.yAxes.find(a => a.id === wall.yStart) : grid.xAxes.find(a => a.id === wall.xStart);

  if (!startAxis || !endAxis || !fixedAxis) return `Muro #${wall.id}`;

  const length = Math.abs(endAxis.position - startAxis.position);
  return `${startAxis.label}→${endAxis.label} @ ${fixedAxis.label} (${length.toFixed(0)}mm)`;
}

/** "Ventana @ 1500mm — Muro X1→X3 @ Y2 (6000mm)" */
export function getOpeningDisplayName(opening, wall, grid) {
  const typeLabel = opening.type === 'door' ? 'Puerta' : 'Ventana';
  const wallName = wall ? getWallDisplayName(wall, grid) : `muro #${opening.wallId ?? '?'}`;
  return `${typeLabel} @ ${opening.position}mm — Muro ${wallName}`;
}

const TYPE_LABEL = { wall: 'Muro', column: 'Pilar', beam: 'Viga', foundation: 'Fundación' };

/** ★ Nombre corto genérico para cualquier elemento (usado al elegir referencias entre elementos). */
export function getElementShortLabel(el, grid) {
  const t = TYPE_LABEL[el.type] || el.type;
  if (el.type === 'wall') return `${t}: ${getWallDisplayName(el, grid)}`;
  if (el.type === 'column') {
    const ax = grid.xAxes.find(a => a.id === el.axisXId);
    const ay = grid.yAxes.find(a => a.id === el.axisYId);
    return `${t} @ ${ax ? ax.label : '?'}×${ay ? ay.label : '?'}`;
  }
  if (el.type === 'foundation' && el.foundationType === 'aislada') {
    const ax = grid.xAxes.find(a => a.id === el.axisXId);
    const ay = grid.yAxes.find(a => a.id === el.axisYId);
    return `${t} aislada @ ${ax ? ax.label : '?'}×${ay ? ay.label : '?'}`;
  }
  // beam / foundation corrida: fijo + rango
  const isXRun = el.direction === 'x';
  const fixedAxis = (isXRun ? grid.yAxes : grid.xAxes).find(a => a.id === el.fixedAxisId);
  const startAxis = (isXRun ? grid.xAxes : grid.yAxes).find(a => a.id === el.startAxisId);
  const endAxis = (isXRun ? grid.xAxes : grid.yAxes).find(a => a.id === el.endAxisId);
  if (!fixedAxis || !startAxis || !endAxis) return `${t} #${el.id}`;
  return `${t} ${startAxis.label}→${endAxis.label} @ ${fixedAxis.label}`;
}

const EDGE_LABEL = { min: 'borde mínimo', max: 'borde máximo', center: 'centro' };

/** ★ Muestra un campo de eje (ID de eje, o referencia a elemento) en texto legible.
 *  Usado en paneles de solo lectura (PropertiesPanel, AuditModal) donde antes se hacía
 *  axes.find(a => a.id === raw)?.label — eso devuelve undefined silenciosamente para
 *  una referencia, sin indicar que en realidad es una referencia válida a otro elemento. */
export function formatAxisFieldLabel(raw, axes, grid, elementsById = {}) {
  if (isElementRef(raw)) {
    const target = elementsById[raw.refElementId];
    const edgeLabel = EDGE_LABEL[raw.edge] || raw.edge;
    if (!target) return `↳ ${edgeLabel} de elemento eliminado (#${raw.refElementId})`;
    return `↳ ${edgeLabel} de ${getElementShortLabel(target, grid)}`;
  }
  return axes.find(a => a.id === raw)?.label ?? '—';
}
