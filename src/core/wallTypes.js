// Contrato puro de tipos de muro. Resuelve la precedencia R5 sin leer el store ni regenerar
// derivados; los consumidores reciben una configuración efectiva y findings canónicos.

import { createFinding } from './domainFindings.js';
import {
  WALL_ROLES,
  isWallRole,
  wallRoleAllowsOsbRotation
} from './wallRoles.js';

export { WALL_ROLES, wallRoleAllowsOsbRotation };

const HISTORICAL_METALCON_DEFAULTS = Object.freeze({
  spacing: 400,
  studProfileId: null,
  trackProfileId: null,
  materialId: null
});

const HISTORICAL_OSB_DEFAULTS = Object.freeze({
  panelWidth: 1220,
  panelHeight: 2440,
  minPanelWidth: 200,
  gap: 5
});

const OVERRIDE_FIELDS = Object.freeze([
  ['framingStudProfileId', 'metalconDefaults', 'studProfileId'],
  ['framingTrackProfileId', 'metalconDefaults', 'trackProfileId'],
  ['framingMaterialId', 'metalconDefaults', 'materialId'],
  ['studSpacing', 'metalconDefaults', 'spacing'],
  ['osbPanelWidth', 'osbDefaults', 'panelWidth'],
  ['osbPanelHeight', 'osbDefaults', 'panelHeight'],
  ['osbMinPanelWidth', 'osbDefaults', 'minPanelWidth']
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validId(value) {
  return (typeof value === 'string' && value.trim().length > 0)
    || (typeof value === 'number' && Number.isFinite(value));
}

function idKey(value) {
  return `${typeof value}:${String(value)}`;
}

function assertPositiveNumber(value, path, { min = 0, allowZero = false } = {}) {
  const valid = Number.isFinite(value) && (allowZero ? value >= min : value > min);
  if (!valid) throw new TypeError(`${path} debe ser un número finito válido.`);
}

function findProfile(library, profileId) {
  return (library?.metalconProfiles || []).find((profile) => (
    idKey(profile?.id) === idKey(profileId)
  ));
}

function assertDefaults(wallType, library) {
  const metalcon = wallType.metalconDefaults;
  const osb = wallType.osbDefaults;
  if (!isRecord(metalcon)) {
    throw new TypeError(`El tipo ${wallType.id} requiere metalconDefaults.`);
  }
  if (!isRecord(osb)) {
    throw new TypeError(`El tipo ${wallType.id} requiere osbDefaults.`);
  }

  for (const field of ['spacing', 'studProfileId', 'trackProfileId', 'materialId']) {
    if (!Object.hasOwn(metalcon, field)) {
      throw new TypeError(`metalconDefaults de ${wallType.id} requiere ${field}.`);
    }
  }
  for (const field of ['panelWidth', 'panelHeight', 'minPanelWidth', 'gap']) {
    if (!Object.hasOwn(osb, field)) {
      throw new TypeError(`osbDefaults de ${wallType.id} requiere ${field}.`);
    }
  }

  assertPositiveNumber(metalcon.spacing, `${wallType.id}.metalconDefaults.spacing`);
  if (!validId(metalcon.studProfileId) || !validId(metalcon.trackProfileId)) {
    throw new TypeError(`El tipo ${wallType.id} requiere IDs de perfil válidos.`);
  }
  if (metalcon.materialId !== null && !validId(metalcon.materialId)) {
    throw new TypeError(`${wallType.id}.metalconDefaults.materialId debe ser un ID o null.`);
  }

  assertPositiveNumber(osb.panelWidth, `${wallType.id}.osbDefaults.panelWidth`);
  assertPositiveNumber(osb.panelHeight, `${wallType.id}.osbDefaults.panelHeight`);
  assertPositiveNumber(osb.minPanelWidth, `${wallType.id}.osbDefaults.minPanelWidth`, {
    min: 200,
    allowZero: true
  });
  if (osb.minPanelWidth < 200) {
    throw new TypeError(`${wallType.id}.osbDefaults.minPanelWidth no puede ser menor a 200.`);
  }
  assertPositiveNumber(osb.gap, `${wallType.id}.osbDefaults.gap`, {
    min: 0,
    allowZero: true
  });

  const stud = findProfile(library, metalcon.studProfileId);
  const track = findProfile(library, metalcon.trackProfileId);
  if (!stud) throw new TypeError(`El perfil montante de ${wallType.id} no existe.`);
  if (stud.shape !== 'C') {
    throw new TypeError(`El perfil montante de ${wallType.id} debe tener shape C.`);
  }
  if (!track) throw new TypeError(`El perfil solera de ${wallType.id} no existe.`);
  if (track.shape !== 'U') {
    throw new TypeError(`El perfil solera de ${wallType.id} debe tener shape U.`);
  }
}

/** Valida la colección persistida completa, incluidas unicidad y referencias a perfiles. */
export function assertValidWallTypes(wallTypes, library = {}) {
  if (!Array.isArray(wallTypes)) throw new TypeError('wallTypes debe ser un array.');
  const ids = new Set();
  for (const wallType of wallTypes) {
    if (!isRecord(wallType)) throw new TypeError('Cada wallType debe ser un objeto.');
    if (!validId(wallType.id)) throw new TypeError('Cada wallType requiere un id válido.');
    const key = idKey(wallType.id);
    if (ids.has(key)) throw new TypeError(`El id de wallType ${wallType.id} está duplicado.`);
    ids.add(key);
    if (typeof wallType.name !== 'string' || wallType.name.trim().length === 0) {
      throw new TypeError(`El tipo ${wallType.id} requiere name.`);
    }
    if (!isWallRole(wallType.role)) {
      throw new TypeError(`El tipo ${wallType.id} tiene role inválido.`);
    }
    assertDefaults(wallType, library);
  }
  return wallTypes;
}

/** Lookup estricto: IDs string y numéricos no se confunden. */
export function getWallType(model, wallTypeId) {
  return (model?.wallTypes || []).find((wallType) => (
    idKey(wallType?.id) === idKey(wallTypeId)
  )) || null;
}

function wallIds(wall) {
  return validId(wall.id) ? [wall.id] : [];
}

function legacyConfig(model, wall) {
  const projectMetalcon = model?.metalconDefaults || {};
  const projectOsb = model?.osbDefaults || {};
  return {
    metalconDefaults: {
      spacing: wall.studSpacing
        ?? projectMetalcon.spacing
        ?? HISTORICAL_METALCON_DEFAULTS.spacing,
      studProfileId: wall.framingStudProfileId
        ?? projectMetalcon.studProfileId
        ?? HISTORICAL_METALCON_DEFAULTS.studProfileId,
      trackProfileId: wall.framingTrackProfileId
        ?? projectMetalcon.trackProfileId
        ?? HISTORICAL_METALCON_DEFAULTS.trackProfileId,
      materialId: wall.framingMaterialId
        ?? projectMetalcon.materialId
        ?? HISTORICAL_METALCON_DEFAULTS.materialId
    },
    osbDefaults: {
      panelWidth: wall.osbPanelWidth
        ?? projectOsb.panelWidth
        ?? HISTORICAL_OSB_DEFAULTS.panelWidth,
      panelHeight: wall.osbPanelHeight
        ?? projectOsb.panelHeight
        ?? HISTORICAL_OSB_DEFAULTS.panelHeight,
      minPanelWidth: wall.osbMinPanelWidth
        ?? projectOsb.minPanelWidth
        ?? HISTORICAL_OSB_DEFAULTS.minPanelWidth,
      gap: wall.osbGap
        ?? projectOsb.gap
        ?? HISTORICAL_OSB_DEFAULTS.gap
    }
  };
}

function ignoredOverrideFinding(wall, wallType, wallField, typeField) {
  return createFinding({
    severity: 'info',
    category: 'wallType',
    message: `Muro ${wall.id}: ${wallField} difiere de ${wallType.name}.${typeField}; se usa el valor del tipo.`,
    wallIds: wallIds(wall)
  });
}

/** Resuelve la configuración efectiva sin mutar ni borrar overrides importados. */
export function resolveWallTypeConfig(model, wall) {
  if (!isRecord(model)) throw new TypeError('model debe ser un objeto.');
  if (!isRecord(wall) || wall.type !== 'wall') {
    throw new TypeError('wall debe ser un elemento de tipo wall.');
  }
  assertValidWallTypes(model.wallTypes || [], model.library || {});

  if (wall.wallTypeId == null) {
    const effective = legacyConfig(model, wall);
    return {
      source: 'legacy',
      wallType: null,
      role: null,
      ...effective,
      findings: [createFinding({
        severity: 'info',
        category: 'wallRole',
        message: `Muro ${wall.id}: sin tipo ni rol declarado; no se aplican reglas condicionadas.`,
        wallIds: wallIds(wall)
      })]
    };
  }

  const wallType = getWallType(model, wall.wallTypeId);
  if (!wallType) {
    throw new TypeError(`wallTypeId ${wall.wallTypeId} no existe.`);
  }
  const findings = [];
  for (const [wallField, group, typeField] of OVERRIDE_FIELDS) {
    if (
      Object.hasOwn(wall, wallField)
      && !Object.is(wall[wallField], wallType[group][typeField])
    ) {
      findings.push(ignoredOverrideFinding(wall, wallType, wallField, `${group}.${typeField}`));
    }
  }
  return {
    source: 'wallType',
    wallType,
    role: wallType.role,
    metalconDefaults: { ...wallType.metalconDefaults },
    osbDefaults: { ...wallType.osbDefaults },
    findings
  };
}
