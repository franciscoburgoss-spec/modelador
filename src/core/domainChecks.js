// Checks constructivos puros de muro. Inspeccionan intención tipada y derivados persistidos,
// declaran cobertura y nunca regeneran ni mutan el modelo.

import {
  isWallXRun,
  resolveWallGeometry,
  resolveWallLocalFrame
} from './elementGeometry.js';
import { buildElementsById, resolveAxisRef } from './elementReferences.js';
import { createFinding } from './domainFindings.js';
import { hasOwn } from './hasOwn.js';
import {
  resolveRuleLimit,
  ruleAppliesToRole
} from './domainRules.js';
import { buildParamsMap, resolveValue } from './projectParams.js';
import { compareStableWallIds } from './wallJunctions.js';
import { resolveWallTypeConfig } from './wallTypes.js';

const GEOMETRY_TOLERANCE_MM = 1;
const SHORT_NOGGING_MM = 30;
const JAMB_WARNING_MM = 150;

function idKey(id) {
  return `${typeof id}:${String(id)}`;
}

function roundMeasured(value) {
  return Math.round(value * 1000) / 1000;
}

function sortedUniqueIds(ids) {
  return [...new Map(ids.map((id) => [idKey(id), id])).values()]
    .sort(compareStableWallIds);
}

function addChecked(checkedById, wallId) {
  checkedById.set(idKey(wallId), wallId);
}

function addSkip(skipped, wallId, rule, reason, extra = {}) {
  skipped.push({ wallId, rule, reason, ...extra });
}

function outsideLimit(value, limit, tolerance = 0) {
  if (hasOwn(limit, 'min') && value < limit.min - tolerance) return true;
  if (hasOwn(limit, 'max') && value > limit.max + tolerance) return true;
  if (hasOwn(limit, 'equal')) {
    return Math.abs(value - limit.equal) > tolerance;
  }
  return false;
}

function wallVerticalRange(wall, grid) {
  const bottom = (grid?.zLevels || []).find((level) => level.id === wall.bottomZ);
  const top = (grid?.zLevels || []).find((level) => level.id === wall.topZ);
  if (!bottom || !top) return null;
  if (!Number.isFinite(bottom.elevation) || !Number.isFinite(top.elevation)) return null;
  return [
    Math.min(bottom.elevation, top.elevation),
    Math.max(bottom.elevation, top.elevation)
  ];
}

function verticalRangesOverlap(a, b) {
  return a && b && Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > GEOMETRY_TOLERANCE_MM;
}

function isFullHeightPiece(piece, wallHeight) {
  return (
    piece?.role !== 'nogging'
    && Number.isFinite(piece?.offset)
    && Number.isFinite(piece?.zMin)
    && Number.isFinite(piece?.zMax)
    && piece.zMin <= GEOMETRY_TOLERANCE_MM
    && piece.zMax >= wallHeight - GEOMETRY_TOLERANCE_MM
  );
}

function checkShortNoggings(wall, findings, checkedById) {
  for (const piece of wall.studs || []) {
    if (
      piece?.role !== 'nogging'
      || !Number.isFinite(piece.oMin)
      || !Number.isFinite(piece.oMax)
    ) {
      continue;
    }
    const length = piece.oMax - piece.oMin;
    if (!(length >= 0) || length >= SHORT_NOGGING_MM) continue;
    addChecked(checkedById, wall.id);
    findings.push(createFinding({
      severity: 'warning',
      category: 'shortNogging',
      message: `Muro ${wall.id}: cadeneta de ${roundMeasured(length)} mm requiere resolución constructiva.`,
      measured: { value: roundMeasured(length), unit: 'mm' },
      limit: { min: SHORT_NOGGING_MM, unit: 'mm' },
      wallIds: [wall.id]
    }));
  }
}

function checkStudJambDistances(
  wall,
  wallHeight,
  findings,
  checkedById,
  skipped
) {
  const ruleId = 'muro.jamba.distanciaMontante';
  if (wall.studsStale === true) {
    addSkip(skipped, wall.id, ruleId, 'framing-stale');
    return;
  }
  if (!Array.isArray(wall.studs) || wall.studs.length === 0) {
    addSkip(skipped, wall.id, ruleId, 'framing-missing');
    return;
  }

  if (!(wallHeight > 0)) {
    addSkip(skipped, wall.id, ruleId, 'wall-height-unresolved');
    return;
  }

  const fullHeight = wall.studs.filter((piece) => isFullHeightPiece(piece, wallHeight));
  const kingOffsets = [...new Set(
    fullHeight
      .filter((piece) => piece.role === 'king')
      .map((piece) => piece.offset)
  )].sort((a, b) => a - b);
  if (kingOffsets.length === 0) {
    addChecked(checkedById, wall.id);
    return;
  }

  for (const kingOffset of kingOffsets) {
    const nearest = fullHeight
      .filter((piece) => Math.abs(piece.offset - kingOffset) >= GEOMETRY_TOLERANCE_MM)
      .map((piece) => Math.abs(piece.offset - kingOffset))
      .sort((a, b) => a - b)[0];
    if (!Number.isFinite(nearest)) {
      addSkip(skipped, wall.id, ruleId, 'full-height-support-missing');
      continue;
    }
    addChecked(checkedById, wall.id);
    if (nearest >= JAMB_WARNING_MM) continue;

    const severity = nearest < SHORT_NOGGING_MM ? 'error' : 'warning';
    const measured = roundMeasured(nearest);
    findings.push(createFinding({
      severity,
      category: 'studJambDistance',
      message: `Muro ${wall.id}: apoyo de altura completa a ${measured} mm eje a eje de la jamba.`,
      measured: { value: measured, unit: 'mm' },
      limit: { min: JAMB_WARNING_MM, unit: 'mm' },
      wallIds: [wall.id]
    }));
  }
}

function checkConfiguredStudSpacing(
  wall,
  effective,
  paramsMap,
  elementsById,
  findings,
  checkedById,
  skipped
) {
  const ruleId = 'muro.montante.paso';
  if (!ruleAppliesToRole(ruleId, effective.role)) return;
  const limit = resolveRuleLimit(ruleId, { role: effective.role });
  const spacing = resolveValue(
    effective.metalconDefaults.spacing,
    paramsMap,
    elementsById
  );
  if (!Number.isFinite(spacing)) {
    addSkip(skipped, wall.id, ruleId, 'stud-spacing-unresolved');
    return;
  }
  addChecked(checkedById, wall.id);
  if (!outsideLimit(spacing, limit)) return;

  findings.push(createFinding({
    category: 'studSpacing',
    message: `Muro ${wall.id}: paso configurado ${roundMeasured(spacing)} mm excede el máximo ${limit.max} mm para ${effective.role}.`,
    rule: ruleId,
    measured: { value: roundMeasured(spacing), unit: 'mm' },
    limit,
    wallIds: [wall.id]
  }));
}

function checkPanelLength(
  wall,
  effective,
  frame,
  findings,
  checkedById,
  skipped
) {
  const ruleId = 'muro.panel.largo';
  if (!ruleAppliesToRole(ruleId, effective.role)) return;
  if (!frame || !(frame.length > 0)) {
    addSkip(skipped, wall.id, ruleId, 'wall-geometry-unresolved');
    return;
  }
  const limit = resolveRuleLimit(ruleId, { role: effective.role });
  addChecked(checkedById, wall.id);
  if (!outsideLimit(frame.length, limit)) return;

  const measured = roundMeasured(frame.length);
  findings.push(createFinding({
    category: 'wallPanelLength',
    message: `Muro ${wall.id}: largo nominal ${measured} mm fuera del límite ${effective.role}.`,
    rule: ruleId,
    measured: { value: measured, unit: 'mm' },
    limit,
    wallIds: [wall.id]
  }));
}

function perpendicularWallsAtReference(
  model,
  host,
  hostFrame,
  reference,
  paramsMap,
  elementsById
) {
  const hostRange = wallVerticalRange(host, model.grid);
  const hostCrossAxis = hostFrame.runAxis === 'x' ? 'y' : 'x';
  const hostFixed = hostFrame.origin[hostCrossAxis];

  return (model.elements || [])
    .filter((candidate) => candidate.type === 'wall' && candidate !== host)
    .flatMap((candidate) => {
      if (isWallXRun(candidate) === isWallXRun(host)) return [];
      const geo = resolveWallGeometry(candidate, model.grid, paramsMap, elementsById);
      const frame = resolveWallLocalFrame(candidate, geo);
      if (!geo || !frame || !Number.isFinite(geo.thickness) || !(geo.thickness > 0)) return [];
      const candidateFixed = frame.origin[hostFrame.runAxis];
      if (Math.abs(candidateFixed - reference) > GEOMETRY_TOLERANCE_MM) return [];
      const runMin = frame.origin[hostCrossAxis];
      const runMax = frame.end[hostCrossAxis];
      if (
        hostFixed < runMin - GEOMETRY_TOLERANCE_MM
        || hostFixed > runMax + GEOMETRY_TOLERANCE_MM
      ) {
        return [];
      }
      if (!verticalRangesOverlap(hostRange, wallVerticalRange(candidate, model.grid))) return [];
      return [{ wall: candidate, geo }];
    });
}

function checkDoorClearances(
  model,
  wall,
  effective,
  geo,
  frame,
  paramsMap,
  elementsById,
  findings,
  checkedById,
  skipped
) {
  const ruleId = 'muro.vano.holguraManilla';
  if (!ruleAppliesToRole(ruleId, effective.role)) return;
  const limit = resolveRuleLimit(ruleId);
  for (const opening of wall.openings || []) {
    if (opening.type !== 'door') continue;
    if (!geo || !frame) {
      addSkip(skipped, wall.id, ruleId, 'wall-geometry-unresolved', {
        openingId: opening.id
      });
      continue;
    }
    if (
      opening.referenceAxisId == null
      || !['left', 'right'].includes(opening.referenceEdge)
    ) {
      addSkip(skipped, wall.id, ruleId, 'reference-edge-unresolved', {
        openingId: opening.id
      });
      continue;
    }
    const reference = resolveAxisRef(
      opening.referenceAxisId,
      frame.runAxis,
      model.grid,
      elementsById,
      paramsMap
    );
    const width = resolveValue(opening.width, paramsMap, elementsById);
    const position = resolveValue(opening.position, paramsMap, elementsById);
    if (
      !Number.isFinite(reference)
      || !Number.isFinite(width)
      || !Number.isFinite(position)
    ) {
      addSkip(skipped, wall.id, ruleId, 'reference-edge-unresolved', {
        openingId: opening.id
      });
      continue;
    }
    const candidates = perpendicularWallsAtReference(
      model,
      wall,
      frame,
      reference,
      paramsMap,
      elementsById
    );
    if (candidates.length === 0) {
      addSkip(skipped, wall.id, ruleId, 'no-perpendicular-wall-at-reference', {
        openingId: opening.id
      });
      continue;
    }

    const thicknesses = [];
    for (const candidate of candidates) {
      if (!thicknesses.some((value) => (
        Math.abs(value - candidate.geo.thickness) <= GEOMETRY_TOLERANCE_MM
      ))) {
        thicknesses.push(candidate.geo.thickness);
      }
    }
    const wallIds = sortedUniqueIds([
      wall.id,
      ...candidates.map((candidate) => candidate.wall.id)
    ]);
    addChecked(checkedById, wall.id);
    if (thicknesses.length > 1) {
      findings.push(createFinding({
        category: 'doorReferenceAmbiguity',
        message: `Muro ${wall.id}, vano ${opening.id}: el eje de referencia cruza muros perpendiculares con espesores distintos.`,
        rule: ruleId,
        wallIds
      }));
      continue;
    }

    const edge = opening.referenceEdge === 'left'
      ? position - width / 2
      : position + width / 2;
    const clearance = Math.abs(edge - reference) - thicknesses[0] / 2;
    if (!outsideLimit(clearance, limit, GEOMETRY_TOLERANCE_MM)) continue;
    const measured = roundMeasured(clearance);
    findings.push(createFinding({
      category: 'doorReferenceClearance',
      message: measured < 0
        ? `Muro ${wall.id}, vano ${opening.id}: el borde de referencia invade ${Math.abs(measured)} mm la cara perpendicular.`
        : `Muro ${wall.id}, vano ${opening.id}: el borde de referencia queda a ${measured} mm de la cara perpendicular.`,
      rule: ruleId,
      measured: { value: measured, unit: 'mm' },
      limit,
      wallIds
    }));
  }
}

/**
 * Evalúa únicamente reglas de muro del corte R7-A. El resultado conserva la cobertura para R8,
 * mientras que `validateModel` consume sólo `findings`.
 */
export function evaluateWallDomainChecks(model) {
  const findings = [];
  const skipped = [];
  const checkedById = new Map();
  const elements = model?.elements || [];
  const paramsMap = buildParamsMap(model?.projectParams || []);
  const elementsById = buildElementsById(elements);

  for (const wall of elements.filter((element) => element.type === 'wall')) {
    const effective = resolveWallTypeConfig(model, wall);
    const geo = resolveWallGeometry(wall, model.grid, paramsMap, elementsById);
    const frame = resolveWallLocalFrame(wall, geo);
    const range = wallVerticalRange(wall, model.grid);
    const wallHeight = range ? range[1] - range[0] : null;

    if (wall.studsStale !== true) {
      checkShortNoggings(wall, findings, checkedById);
    }
    if (effective.role == null) {
      addSkip(skipped, wall.id, null, 'wall-role-unresolved');
      continue;
    }

    checkConfiguredStudSpacing(
      wall,
      effective,
      paramsMap,
      elementsById,
      findings,
      checkedById,
      skipped
    );
    checkStudJambDistances(
      wall,
      wallHeight,
      findings,
      checkedById,
      skipped
    );
    checkDoorClearances(
      model,
      wall,
      effective,
      geo,
      frame,
      paramsMap,
      elementsById,
      findings,
      checkedById,
      skipped
    );
    checkPanelLength(
      wall,
      effective,
      frame,
      findings,
      checkedById,
      skipped
    );
  }

  return {
    findings,
    coverage: {
      checkedWallIds: [...checkedById.values()].sort(compareStableWallIds),
      skipped
    }
  };
}
