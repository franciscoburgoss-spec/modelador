// Checks puros de llegada de cercha a jambas. Consumen la fuente viva unificada de techumbre y
// nunca regeneran ni persisten derivados.

import {
  resolveWallGeometry,
  resolveWallLocalFrame
} from './elementGeometry.js';
import { buildElementsById } from './elementReferences.js';
import { createFinding } from './domainFindings.js';
import {
  resolveRuleLimit,
  ruleAppliesToRole
} from './domainRules.js';
import { getRoofSystems } from './roofPlaneOutputs.js';
import { buildParamsMap, resolveValue } from './projectParams.js';
import { compareStableWallIds } from './wallJunctions.js';
import { resolveWallTypeConfig } from './wallTypes.js';

const EPS = 1e-6;
const SUPPORT_ELEVATION_TOLERANCE_MM = 1;

function idKey(id) {
  return `${typeof id}:${String(id)}`;
}

function roundMeasured(value) {
  return Math.round(value * 1000) / 1000;
}

function validId(value) {
  return (typeof value === 'string' && value.length > 0)
    || (typeof value === 'number' && Number.isFinite(value));
}

function sourceIds(system) {
  if (validId(system.planeId)) return { roofPlaneIds: [system.planeId] };
  if (validId(system.id)) return { roofSystemIds: [system.id] };
  return {};
}

function supportWallIds(system) {
  const highIds = Array.isArray(system.wallHighIds) && system.wallHighIds.length > 0
    ? system.wallHighIds
    : [system.wallHighId];
  return [...new Map(
    [system.wallLowId, ...highIds]
      .filter(validId)
      .map((id) => [idKey(id), id])
  ).values()];
}

function addSkip(skipped, wallId, reason, system, extra = {}) {
  skipped.push({
    wallId,
    rule: 'muro.dintel.llegadaCercha',
    reason,
    ...sourceIds(system),
    ...extra
  });
}

function wallAliveAtElevation(wall, elevation, grid) {
  const bottom = (grid?.zLevels || []).find((level) => level.id === wall.bottomZ);
  const top = (grid?.zLevels || []).find((level) => level.id === wall.topZ);
  if (
    !Number.isFinite(elevation)
    || !Number.isFinite(bottom?.elevation)
    || !Number.isFinite(top?.elevation)
  ) {
    return null;
  }
  const lo = Math.min(bottom.elevation, top.elevation);
  const hi = Math.max(bottom.elevation, top.elevation);
  return (
    elevation >= lo - SUPPORT_ELEVATION_TOLERANCE_MM
    && elevation <= hi + SUPPORT_ELEVATION_TOLERANCE_MM
  );
}

function findProfile(library, profileId) {
  return (library?.metalconProfiles || []).find((profile) => (
    idKey(profile?.id) === idKey(profileId)
  )) || null;
}

function openingFootprints(wall, paramsMap, elementsById, skipped, system) {
  const byFootprint = new Map();
  for (const opening of wall.openings || []) {
    const position = resolveValue(opening.position, paramsMap, elementsById);
    const width = resolveValue(opening.width, paramsMap, elementsById);
    if (!Number.isFinite(position) || !(width > 0)) {
      addSkip(skipped, wall.id, 'opening-footprint-unresolved', system, {
        openingId: opening.id
      });
      continue;
    }
    const min = position - width / 2;
    const max = position + width / 2;
    const key = `${Math.round(min * 1000)}|${Math.round(max * 1000)}`;
    if (!byFootprint.has(key)) byFootprint.set(key, { min, max });
  }
  return [...byFootprint.values()];
}

function uniqueTrussOffsets(system) {
  return [...new Set(
    (system.trussPositions || [])
      .map((position) => position?.offset)
      .filter(Number.isFinite)
  )].sort((a, b) => a - b);
}

/**
 * Evalúa las llegadas de la fuente viva de techumbre sobre los vanos de sus muros de apoyo.
 * Los vanos apilados de huella idéntica y las posiciones repetidas se agrupan.
 */
export function evaluateRoofSupportChecks(model) {
  const findings = [];
  const skipped = [];
  const checkedById = new Map();
  const elements = model?.elements || [];
  const wallsById = new Map(
    elements
      .filter((element) => element.type === 'wall')
      .map((wall) => [idKey(wall.id), wall])
  );
  const paramsMap = buildParamsMap(model?.projectParams || []);
  const elementsById = buildElementsById(elements);
  const systems = getRoofSystems(model);

  for (const system of systems) {
    const wallIds = supportWallIds(system);
    if (system.stale === true) {
      for (const wallId of wallIds) addSkip(skipped, wallId, 'roof-system-stale', system);
      continue;
    }
    const positions = uniqueTrussOffsets(system);
    if (positions.length === 0) {
      for (const wallId of wallIds) addSkip(skipped, wallId, 'truss-positions-missing', system);
      continue;
    }

    for (const wallId of wallIds) {
      const wall = wallsById.get(idKey(wallId));
      if (!wall) {
        addSkip(skipped, wallId, 'support-wall-missing', system);
        continue;
      }
      const effective = resolveWallTypeConfig(model, wall);
      if (
        effective.role !== null
        && !ruleAppliesToRole('muro.dintel.llegadaCercha', effective.role)
      ) {
        addSkip(skipped, wall.id, 'wall-role-not-applicable', system);
        continue;
      }
      const geo = resolveWallGeometry(wall, model.grid, paramsMap, elementsById);
      const frame = resolveWallLocalFrame(wall, geo);
      if (!frame) {
        addSkip(skipped, wall.id, 'support-wall-geometry-unresolved', system);
        continue;
      }
      if (frame.runAxis !== system.runAxis) {
        addSkip(skipped, wall.id, 'support-wall-axis-mismatch', system);
        continue;
      }
      const alive = wallAliveAtElevation(wall, system.supportElevation, model.grid);
      if (alive === null) {
        addSkip(skipped, wall.id, 'support-elevation-unresolved', system);
        continue;
      }
      if (!alive) {
        addSkip(skipped, wall.id, 'support-wall-outside-elevation', system);
        continue;
      }

      const profile = findProfile(
        model.library,
        effective.metalconDefaults.studProfileId
      );
      const flangeWidth = resolveValue(profile?.B, paramsMap, elementsById);
      const limit = resolveRuleLimit('muro.dintel.llegadaCercha', { flangeWidth });
      if (!limit) {
        addSkip(skipped, wall.id, 'stud-flange-unresolved', system);
        continue;
      }

      checkedById.set(idKey(wall.id), wall.id);
      const footprints = openingFootprints(
        wall,
        paramsMap,
        elementsById,
        skipped,
        system
      );
      for (const offset of positions) {
        for (const footprint of footprints) {
          if (offset < footprint.min - EPS || offset > footprint.max + EPS) continue;
          const distance = Math.min(
            Math.abs(offset - footprint.min),
            Math.abs(footprint.max - offset)
          );
          if (distance <= limit.max + EPS) continue;
          const measured = roundMeasured(distance);
          findings.push(createFinding({
            category: 'trussJambAlignment',
            rule: 'muro.dintel.llegadaCercha',
            message: `Muro ${wall.id}: cercha en ${roundMeasured(offset)} mm llega sobre vano a ${measured} mm de la jamba más cercana.`,
            measured: { value: measured, unit: 'mm' },
            limit,
            wallIds: [wall.id],
            ...sourceIds(system)
          }));
        }
      }
    }
  }

  return {
    findings,
    coverage: {
      checkedWallIds: [...checkedById.values()].sort(compareStableWallIds),
      skipped
    }
  };
}
