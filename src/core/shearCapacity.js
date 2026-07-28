// Capacidad admisible de corte por dirección para muros MP1. Este módulo sólo inspecciona el
// modelo persistido: no regenera framing/OSB ni convierte evidencia ausente en cumplimiento.

import {
  resolveWallGeometry,
  resolveWallLocalFrame
} from './elementGeometry.js';
import { buildElementsById } from './elementReferences.js';
import { createFinding } from './domainFindings.js';
import { resolveRuleLimit } from './domainRules.js';
import { buildParamsMap, resolveValue } from './projectParams.js';
import { compareStableWallIds } from './wallJunctions.js';
import { resolveWallTypeConfig } from './wallTypes.js';

const CAPACITY_KGF_M = resolveRuleLimit('muro.corte.capacidadOsb').equal;
const GEOMETRY_TOLERANCE_MM = 1;
const MIN_STUD_THICKNESS_MM = 0.85;
const MIN_TRACK_THICKNESS_MM = 0.85;
const MAX_STUD_SPACING_MM = 610;
const MIN_LENGTH_AT_2400_MM = 1200;
const MAX_ASPECT_RATIO = 2;

function idKey(id) {
  return `${typeof id}:${String(id)}`;
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function condition(code, status, measured, limit) {
  return { code, status, measured, limit };
}

function findProfile(model, profileId) {
  return (model?.library?.metalconProfiles || []).find((profile) => (
    idKey(profile?.id) === idKey(profileId)
  )) || null;
}

function resolveWallHeight(model, wall) {
  const bottom = (model?.grid?.zLevels || []).find((level) => level.id === wall.bottomZ);
  const top = (model?.grid?.zLevels || []).find((level) => level.id === wall.topZ);
  if (!Number.isFinite(bottom?.elevation) || !Number.isFinite(top?.elevation)) return null;
  const height = top.elevation - bottom.elevation;
  return height > 0 ? height : null;
}

function aspectRatioCondition(lengthMm, heightMm) {
  const resolvable = Number.isFinite(lengthMm)
    && lengthMm > 0
    && Number.isFinite(heightMm)
    && heightMm > 0;
  if (!resolvable) {
    return condition(
      'wall.aspectRatio',
      'fail',
      null,
      { lengthMinMmAt2400: MIN_LENGTH_AT_2400_MM, ratioExclusiveMax: MAX_ASPECT_RATIO }
    );
  }
  const ratio = heightMm / lengthMm;
  const exactHeightPass = heightMm === 2400
    && lengthMm >= MIN_LENGTH_AT_2400_MM;
  const ratioPass = ratio < MAX_ASPECT_RATIO;
  return condition(
    'wall.aspectRatio',
    exactHeightPass || ratioPass ? 'pass' : 'fail',
    {
      heightMm: round(heightMm),
      lengthMm: round(lengthMm),
      ratio: round(ratio)
    },
    { lengthMinMmAt2400: MIN_LENGTH_AT_2400_MM, ratioExclusiveMax: MAX_ASPECT_RATIO }
  );
}

function profileConditions(profile, kind) {
  const stud = kind === 'stud';
  const series = stud ? 90 : 92;
  const thickness = stud ? MIN_STUD_THICKNESS_MM : MIN_TRACK_THICKNESS_MM;
  return [
    condition(
      `wall.${kind}.series`,
      Number.isFinite(profile?.H) && profile.H === series
        ? 'pass'
        : 'fail',
      Number.isFinite(profile?.H) ? { value: profile.H, unit: 'mm' } : null,
      { equal: series, unit: 'mm' }
    ),
    condition(
      `wall.${kind}.thickness`,
      Number.isFinite(profile?.e) && profile.e >= thickness
        ? 'pass'
        : 'fail',
      Number.isFinite(profile?.e) ? { value: profile.e, unit: 'mm' } : null,
      { min: thickness, unit: 'mm' }
    )
  ];
}

function coursesCoverFullHeight(courses, wallHeight) {
  if (
    !Array.isArray(courses)
    || courses.length === 0
    || !Number.isFinite(wallHeight)
    || wallHeight <= 0
  ) {
    return false;
  }
  const spans = courses.map((course) => ({
    zMin: course?.zMin,
    zMax: course?.zMax,
    hasPanels: Array.isArray(course?.panels) && course.panels.length > 0
  }));
  if (spans.some((span) => (
    !Number.isFinite(span.zMin)
    || !Number.isFinite(span.zMax)
    || span.zMax <= span.zMin
    || !span.hasPanels
  ))) {
    return false;
  }
  spans.sort((a, b) => a.zMin - b.zMin || a.zMax - b.zMax);
  let coveredTo = 0;
  for (const span of spans) {
    if (span.zMin > coveredTo + GEOMETRY_TOLERANCE_MM) return false;
    coveredTo = Math.max(coveredTo, span.zMax);
  }
  return coveredTo >= wallHeight - GEOMETRY_TOLERANCE_MM;
}

function osbCoverageCondition(wall, wallHeight) {
  const present = Array.isArray(wall.osbCourses) && wall.osbCourses.length > 0;
  const current = wall.osbStale !== true && wall.studsStale !== true;
  const fullHeight = coursesCoverFullHeight(wall.osbCourses, wallHeight);
  return condition(
    'wall.osb.fullHeight',
    present && current && fullHeight ? 'pass' : 'fail',
    { present, current, fullHeight },
    { present: true, current: true, fullHeight: true }
  );
}

/**
 * Clasifica un conjunto de condiciones ya resueltas. La rama `verified` queda disponible para
 * evidencia futura, pero R7-C conserva como `unknown` las cuatro condiciones que el modelo aún
 * no representa.
 */
export function classifyShearCapacity(conditions, lengthM) {
  if (!Array.isArray(conditions)) throw new TypeError('conditions debe ser un array.');
  const failed = conditions.some((item) => item?.status === 'fail');
  const unknown = conditions.some((item) => item?.status === 'unknown');
  if (failed || !(Number.isFinite(lengthM) && lengthM > 0)) {
    return {
      status: 'excluded',
      capacityKgf: null,
      conditionalCapacityKgf: null
    };
  }
  const capacity = round(CAPACITY_KGF_M * lengthM);
  if (unknown) {
    return {
      status: 'conditional',
      capacityKgf: null,
      conditionalCapacityKgf: capacity
    };
  }
  return {
    status: 'verified',
    capacityKgf: capacity,
    conditionalCapacityKgf: null
  };
}

function wallConditions(model, wall, effective, frame, wallHeight, paramsMap, elementsById) {
  const lengthMm = frame?.length;
  const geometryResolved = Number.isFinite(lengthMm)
    && lengthMm > 0
    && Number.isFinite(wallHeight)
    && wallHeight > 0;
  const studProfile = findProfile(model, effective.metalconDefaults.studProfileId);
  const trackProfile = findProfile(model, effective.metalconDefaults.trackProfileId);
  const spacing = resolveValue(
    effective.metalconDefaults.spacing,
    paramsMap,
    elementsById
  );
  const openingCount = Array.isArray(wall.openings) ? wall.openings.length : 0;

  return [
    condition('wall.role.mp1', 'pass', effective.role, 'MP1'),
    condition(
      'wall.geometry',
      geometryResolved ? 'pass' : 'fail',
      geometryResolved
        ? {
            direction: frame.runAxis,
            lengthMm: round(lengthMm),
            heightMm: round(wallHeight)
          }
        : null,
      { lengthMm: '> 0', heightMm: '> 0' }
    ),
    condition(
      'wall.openings',
      openingCount === 0 ? 'pass' : 'fail',
      { count: openingCount },
      { max: 0, unit: 'count' }
    ),
    aspectRatioCondition(lengthMm, wallHeight),
    ...profileConditions(studProfile, 'stud'),
    ...profileConditions(trackProfile, 'track'),
    condition(
      'wall.stud.spacing',
      Number.isFinite(spacing) && spacing <= MAX_STUD_SPACING_MM ? 'pass' : 'fail',
      Number.isFinite(spacing) ? { value: round(spacing), unit: 'mm' } : null,
      { max: MAX_STUD_SPACING_MM, unit: 'mm' }
    ),
    osbCoverageCondition(wall, wallHeight),
    condition('osb.thickness', 'unknown', null, { min: '7/16 in' }),
    condition('osb.faces', 'unknown', null, { equal: 1 }),
    condition('osb.fasteners', 'unknown', null, { specification: '§1.5.2.1' }),
    condition('wall.endStuds.double', 'unknown', null, { required: true })
  ];
}

function emptyDirectionTotal() {
  return {
    verifiedCapacityKgf: 0,
    conditionalCapacityKgf: 0,
    excludedLengthM: 0,
    wallCounts: { verified: 0, conditional: 0, excluded: 0 }
  };
}

function addWallToTotal(total, wall) {
  total.wallCounts[wall.status] += 1;
  if (wall.status === 'verified') {
    total.verifiedCapacityKgf = round(total.verifiedCapacityKgf + wall.capacityKgf);
  } else if (wall.status === 'conditional') {
    total.conditionalCapacityKgf = round(
      total.conditionalCapacityKgf + wall.conditionalCapacityKgf
    );
  } else if (Number.isFinite(wall.lengthM)) {
    total.excludedLengthM = round(total.excludedLengthM + wall.lengthM);
  }
}

/** Resume resultados ya clasificados sin mezclar los tres estados ni sus magnitudes. */
export function summarizeShearCapacityByDirection(walls) {
  if (!Array.isArray(walls)) throw new TypeError('walls debe ser un array.');
  const totals = {
    x: emptyDirectionTotal(),
    y: emptyDirectionTotal()
  };
  for (const wall of walls) {
    if (!['x', 'y'].includes(wall?.direction)) {
      throw new TypeError('Cada resultado de muro requiere direction x o y.');
    }
    if (!['verified', 'conditional', 'excluded'].includes(wall?.status)) {
      throw new TypeError('Cada resultado de muro requiere un status válido.');
    }
    addWallToTotal(totals[wall.direction], wall);
  }
  return totals;
}

function directionFinding(direction, total, wallIds) {
  const counts = total.wallCounts;
  const label = direction.toUpperCase();
  return createFinding({
    category: 'shearCapacity',
    message: `Dirección ${label}: ${total.verifiedCapacityKgf} kgf verificados; ${total.conditionalCapacityKgf} kgf condicionados; cobertura ${counts.verified} verificables, ${counts.conditional} condicionados, ${counts.excluded} excluidos (${total.excludedLengthM} m excluidos).`,
    rule: 'muro.corte.capacidadOsb',
    measured: { value: total.verifiedCapacityKgf, unit: 'kgf' },
    ...(wallIds.length > 0 ? { wallIds } : {})
  });
}

/**
 * Calcula el contrato B7 sin mutar el modelo. Sólo los muros con rol MP1 forman la matriz; los
 * demás quedan documentados en cobertura.
 */
export function computeShearCapacityByDirection(model) {
  const walls = [];
  const skipped = [];
  const checkedWallIds = [];
  const paramsMap = buildParamsMap(model?.projectParams || []);
  const elementsById = buildElementsById(model?.elements || []);

  for (const wall of (model?.elements || []).filter((element) => element.type === 'wall')) {
    const effective = resolveWallTypeConfig(model, wall);
    if (effective.role == null) {
      skipped.push({
        wallId: wall.id,
        rule: 'muro.corte.capacidadOsb',
        reason: 'wall-role-unresolved'
      });
      continue;
    }
    if (effective.role !== 'MP1') {
      skipped.push({
        wallId: wall.id,
        rule: 'muro.corte.capacidadOsb',
        reason: 'rule-not-applicable',
        role: effective.role
      });
      continue;
    }

    const geo = resolveWallGeometry(wall, model.grid, paramsMap, elementsById);
    const frame = resolveWallLocalFrame(wall, geo);
    const direction = frame?.runAxis ?? (wall.direction === 'y' ? 'y' : 'x');
    const wallHeight = resolveWallHeight(model, wall);
    const lengthM = Number.isFinite(frame?.length) && frame.length > 0
      ? round(frame.length / 1000)
      : null;
    const conditions = wallConditions(
      model,
      wall,
      effective,
      frame,
      wallHeight,
      paramsMap,
      elementsById
    );
    const classification = classifyShearCapacity(conditions, lengthM);
    walls.push({
      wallId: wall.id,
      direction,
      lengthM,
      ...classification,
      conditions
    });
    checkedWallIds.push(wall.id);
  }

  const totals = summarizeShearCapacityByDirection(walls);

  const findings = ['x', 'y'].flatMap((direction) => {
    const wallIds = walls
      .filter((wall) => wall.direction === direction)
      .map((wall) => wall.wallId)
      .sort(compareStableWallIds);
    return wallIds.length > 0
      ? [directionFinding(direction, totals[direction], wallIds)]
      : [];
  });

  return {
    walls,
    totals,
    findings,
    coverage: {
      checkedWallIds: [...checkedWallIds].sort(compareStableWallIds),
      skipped
    }
  };
}
