import { projectAgnosticGeometry, projectAgnosticRoofGeometry } from './agnosticGeometry.js';
import { hasOwn } from './hasOwn.js';
import { isValidParamName } from './projectParams.js';
import { assertValidWallTypes } from './wallTypes.js';
import {
  canonicalizeStructuralIntent,
  canonicalizeStructuralIntentFindings,
  createEmptyStructuralIntent,
  migrateStructuralIntentSchema,
  validateStructuralIntent,
  validateStructuralIntentFindings
} from './structuralIntent.js';
import {
  canonicalizeStructuralIntentTrace,
  validateStructuralIntentTrace
} from './structuralIntentTrace.js';
import {
  canonicalizeStructuralProposalReviewLog,
  createEmptyStructuralProposalReviewLog,
  validateStructuralProposalReviewLog
} from './structuralProposalReviews.js';

export const CURRENT_MODEL_VERSION = 3;
export const LEGACY_MODEL_VERSION = 0;

export class ModelImportError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'ModelImportError';
    this.code = code;
    this.details = details;
  }
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJsonValue(value, ancestors = new Set(), depth = 0) {
  if (depth > 256) {
    throw new ModelImportError('MODEL_TOO_DEEP', 'El modelo excede la profundidad máxima.');
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ModelImportError('INVALID_MODEL_VALUE', 'El modelo contiene un número no finito.');
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new ModelImportError('INVALID_MODEL_VALUE', 'El modelo contiene un valor no serializable.');
  }
  if (ancestors.has(value)) {
    throw new ModelImportError('CYCLIC_MODEL', 'El modelo contiene una referencia circular.');
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item, nextAncestors, depth + 1));
  }
  if (!isRecord(value)) {
    throw new ModelImportError('INVALID_MODEL_VALUE', 'El modelo contiene un objeto no serializable.');
  }

  const clone = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__') {
      throw new ModelImportError('FORBIDDEN_MODEL_KEY', 'El modelo contiene la clave prohibida __proto__.');
    }
    clone[key] = cloneJsonValue(item, nextAncestors, depth + 1);
  }
  return clone;
}

function migrateV0ToV1(model) {
  return {
    ...model,
    modelVersion: 1,
    roofSystems: Array.isArray(model.roofSystems) ? model.roofSystems : [],
    roofPlanes: Array.isArray(model.roofPlanes) ? model.roofPlanes : []
  };
}

function migrateV1ToV2(model) {
  return {
    ...model,
    modelVersion: 2,
    wallTypes: hasOwn(model, 'wallTypes') ? model.wallTypes : []
  };
}

function migrateV2ToV3(model) {
  return {
    ...model,
    modelVersion: 3,
    structuralIntent: createEmptyStructuralIntent(),
    structuralProposalReviews: createEmptyStructuralProposalReviewLog()
  };
}

const MIGRATIONS = new Map([
  [0, migrateV0ToV1],
  [1, migrateV1ToV2],
  [2, migrateV2ToV3]
]);

function declaredVersion(model) {
  if (!hasOwn(model, 'modelVersion')) return LEGACY_MODEL_VERSION;
  if (!Number.isInteger(model.modelVersion) || model.modelVersion < 0) {
    throw new ModelImportError(
      'INVALID_MODEL_VERSION',
      'modelVersion debe ser un entero no negativo.'
    );
  }
  if (model.modelVersion > CURRENT_MODEL_VERSION) {
    throw new ModelImportError(
      'FUTURE_MODEL_VERSION',
      `El archivo usa modelVersion ${model.modelVersion}; esta aplicación admite hasta ${CURRENT_MODEL_VERSION}.`
    );
  }
  return model.modelVersion;
}

export function migrateModel(input) {
  if (!isRecord(input)) {
    throw new ModelImportError('INVALID_MODEL_TYPE', 'El modelo debe ser un objeto JSON.');
  }

  let model = cloneJsonValue(input);
  let version = declaredVersion(model);
  const appliedMigrations = [];

  while (version < CURRENT_MODEL_VERSION) {
    const migration = MIGRATIONS.get(version);
    if (!migration) {
      throw new ModelImportError(
        'UNSUPPORTED_MODEL_VERSION',
        `No existe migración desde modelVersion ${version}.`
      );
    }
    const next = migration(model);
    if (!isRecord(next) || next.modelVersion !== version + 1) {
      throw new ModelImportError(
        'INVALID_MIGRATION',
        `La migración desde modelVersion ${version} produjo un resultado inválido.`
      );
    }
    model = next;
    appliedMigrations.push(`${version}->${version + 1}`);
    version = model.modelVersion;
  }

  model = {
    ...model,
    structuralIntent: migrateStructuralIntentSchema(model.structuralIntent)
  };
  return { model, appliedMigrations };
}

function addIssue(issues, path, code, message) {
  issues.push({ path, code, message });
}

function requireArray(value, path, issues) {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'EXPECTED_ARRAY', `${path} debe ser un arreglo.`);
    return false;
  }
  return true;
}

function validateUniqueIds(items, path, issues) {
  const ids = new Set();
  items.forEach((item, index) => {
    if (!isRecord(item)) {
      addIssue(issues, `${path}[${index}]`, 'EXPECTED_OBJECT', 'El elemento debe ser un objeto.');
      return;
    }
    if (item.id === undefined || item.id === null || item.id === '') {
      addIssue(issues, `${path}[${index}].id`, 'MISSING_ID', 'Falta un identificador.');
      return;
    }
    const key = `${typeof item.id}:${String(item.id)}`;
    if (ids.has(key)) {
      addIssue(issues, `${path}[${index}].id`, 'DUPLICATE_ID', `El identificador ${item.id} está duplicado.`);
    }
    ids.add(key);
  });
}

function validateAxes(items, path, coordinate, issues) {
  if (!requireArray(items, path, issues)) return;
  validateUniqueIds(items, path, issues);
  items.forEach((axis, index) => {
    if (!isRecord(axis)) return;
    if (typeof axis[coordinate] !== 'number' || !Number.isFinite(axis[coordinate])) {
      addIssue(
        issues,
        `${path}[${index}].${coordinate}`,
        'INVALID_COORDINATE',
        `${coordinate} debe ser un número finito.`
      );
    }
  });
}

export function validateModel(model) {
  const issues = [];
  if (!isRecord(model)) {
    return [{ path: '$', code: 'EXPECTED_OBJECT', message: 'El modelo debe ser un objeto.' }];
  }
  if (model.modelVersion !== CURRENT_MODEL_VERSION) {
    addIssue(
      issues,
      'modelVersion',
      'INVALID_MODEL_VERSION',
      `modelVersion debe ser ${CURRENT_MODEL_VERSION}.`
    );
  }
  if (!isRecord(model.grid)) {
    addIssue(issues, 'grid', 'MISSING_GRID', 'El modelo debe contener una grilla.');
  } else {
    validateAxes(model.grid.xAxes, 'grid.xAxes', 'position', issues);
    validateAxes(model.grid.yAxes, 'grid.yAxes', 'position', issues);
    validateAxes(model.grid.zLevels, 'grid.zLevels', 'elevation', issues);
  }
  const validElements = requireArray(model.elements, 'elements', issues);
  if (validElements) {
    validateUniqueIds(model.elements, 'elements', issues);
    model.elements.forEach((element, index) => {
      if (isRecord(element) && (typeof element.type !== 'string' || element.type === '')) {
        addIssue(issues, `elements[${index}].type`, 'MISSING_ELEMENT_TYPE', 'El elemento debe declarar type.');
      }
    });
  }

  const validWallTypes = requireArray(model.wallTypes, 'wallTypes', issues);
  if (validWallTypes) {
    validateUniqueIds(model.wallTypes, 'wallTypes', issues);
    try {
      assertValidWallTypes(model.wallTypes, isRecord(model.library) ? model.library : {});
    } catch (error) {
      addIssue(
        issues,
        'wallTypes',
        'INVALID_WALL_TYPE',
        error instanceof Error ? error.message : 'wallTypes contiene un tipo inválido.'
      );
    }
  }
  if (validElements) {
    const wallTypeIds = new Set(
      validWallTypes
        ? model.wallTypes.filter(isRecord).map((wallType) => (
            `${typeof wallType.id}:${String(wallType.id)}`
          ))
        : []
    );
    model.elements.forEach((element, index) => {
      if (!isRecord(element) || element.type !== 'wall') return;
      if (hasOwn(element, 'role')) {
        addIssue(
          issues,
          `elements[${index}].role`,
          'FORBIDDEN_WALL_ROLE',
          'El rol vive en wallTypes; un muro no puede declarar role.'
        );
      }
      if (element.wallTypeId != null) {
        const key = `${typeof element.wallTypeId}:${String(element.wallTypeId)}`;
        if (!wallTypeIds.has(key)) {
          addIssue(
            issues,
            `elements[${index}].wallTypeId`,
            'BROKEN_WALL_TYPE_REFERENCE',
            `wallTypeId ${element.wallTypeId} no referencia un tipo existente.`
          );
        }
      }
    });
  }

  for (const field of ['projectParams', 'dimensions', 'roofSystems', 'roofPlanes']) {
    if (model[field] !== undefined && requireArray(model[field], field, issues)) {
      if (field !== 'projectParams') validateUniqueIds(model[field], field, issues);
    }
  }
  const structuralRoofIds = [
    ...(Array.isArray(model.structuralIntent?.roofIntents)
      ? model.structuralIntent.roofIntents.map((intent) => intent?.roofGeometryId)
      : []),
    ...(Array.isArray(model.structuralIntentFindings)
      ? model.structuralIntentFindings
        .filter((finding) => finding?.roofGeometryId !== undefined)
        .map((finding) => finding.roofGeometryId)
      : [])
  ];
  let structuralRoofGeometry = [];
  if (structuralRoofIds.length > 0) {
    try {
      structuralRoofGeometry = projectAgnosticRoofGeometry(model, structuralRoofIds);
    } catch (error) {
      addIssue(
        issues,
        'structuralIntent.roofIntents',
        error?.code || 'SI-ROOF-GEOMETRY-UNRESOLVABLE',
        error instanceof Error ? error.message : 'La geometría de cubierta declarada no es resoluble.'
      );
    }
  }
  let structuralAgnosticGeometry = null;
  if ((model.structuralIntent?.interfaceIntents?.length || 0) > 0
    || (model.structuralIntent?.relationIntents?.length || 0) > 0) {
    try {
      structuralAgnosticGeometry = projectAgnosticGeometry(model);
    } catch (error) {
      addIssue(
        issues,
        'structuralIntent.interfaceIntents',
        error?.code || 'SI-INTERFACE-GEOMETRY-UNRESOLVABLE',
        error instanceof Error ? error.message : 'La geometría requerida por interfaces no es resoluble.'
      );
    }
  }
  issues.push(...validateStructuralIntent(
    model.structuralIntent,
    validElements ? model.elements : [],
    structuralRoofGeometry,
    structuralAgnosticGeometry
  ));
  issues.push(...validateStructuralIntentFindings(
    model.structuralIntentFindings,
    validElements ? model.elements : [],
    structuralRoofGeometry
  ));
  issues.push(...validateStructuralIntentTrace(model.structuralIntentTrace));
  issues.push(...validateStructuralProposalReviewLog(model.structuralProposalReviews));

  if (Array.isArray(model.projectParams)) {
    model.projectParams.forEach((parameter, index) => {
      if (!isRecord(parameter)) {
        addIssue(issues, `projectParams[${index}]`, 'EXPECTED_OBJECT', 'El parámetro debe ser un objeto.');
      } else if (!isValidParamName(parameter.name)) {
        addIssue(
          issues,
          `projectParams[${index}].name`,
          'INVALID_PARAMETER_NAME',
          `El nombre de parámetro "${parameter.name}" no está permitido.`
        );
      }
    });
  }
  if (model.library !== undefined && !isRecord(model.library)) {
    addIssue(issues, 'library', 'EXPECTED_OBJECT', 'library debe ser un objeto.');
  }
  if (model.currentZLevelId != null && isRecord(model.grid) && Array.isArray(model.grid.zLevels)) {
    const exists = model.grid.zLevels.some((level) => level?.id === model.currentZLevelId);
    if (!exists) {
      addIssue(
        issues,
        'currentZLevelId',
        'BROKEN_LEVEL_REFERENCE',
        'currentZLevelId no referencia un nivel de la grilla.'
      );
    }
  }
  return issues;
}

function modelWarnings(model, appliedMigrations) {
  const warnings = [];
  if (appliedMigrations.length > 0) {
    warnings.push({
      code: 'LEGACY_MODEL_MIGRATED',
      message: `El proyecto se migró a modelVersion ${CURRENT_MODEL_VERSION} sin sobrescribir el archivo original.`
    });
  }
  const hasSystems = Array.isArray(model.roofSystems) && model.roofSystems.length > 0;
  const hasPlanes = Array.isArray(model.roofPlanes) && model.roofPlanes.length > 0;
  if (hasSystems && hasPlanes) {
    warnings.push({
      code: 'ROOF_SOURCE_PRECEDENCE',
      message: 'El proyecto conserva roofSystems heredados; roofPlanes tiene precedencia para cálculo y representación.'
    });
  } else if (hasSystems) {
    warnings.push({
      code: 'LEGACY_ROOF_SYSTEMS_PRESERVED',
      message: 'El proyecto contiene roofSystems heredados, preservados sin pérdida.'
    });
  }
  return warnings;
}

export function prepareModelImport(input) {
  const { model, appliedMigrations } = migrateModel(input);
  const issues = validateModel(model);
  if (issues.length > 0) {
    throw new ModelImportError(
      'MODEL_VALIDATION_FAILED',
      `El modelo no cumple el esquema (${issues.length} problema${issues.length === 1 ? '' : 's'}).`,
      issues
    );
  }
  const canonicalModel = {
    ...model,
    structuralIntent: canonicalizeStructuralIntent(model.structuralIntent),
    ...(model.structuralIntentFindings !== undefined
      ? {
          structuralIntentFindings: canonicalizeStructuralIntentFindings(
            model.structuralIntentFindings
          )
        }
      : {}),
    ...(model.structuralIntentTrace !== undefined
      ? {
          structuralIntentTrace: canonicalizeStructuralIntentTrace(
            model.structuralIntentTrace
          )
        }
      : {})
,
    ...(model.structuralProposalReviews !== undefined
      ? {
          structuralProposalReviews: canonicalizeStructuralProposalReviewLog(
            model.structuralProposalReviews
          )
        }
      : {})
  };
  return {
    model: canonicalModel,
    appliedMigrations,
    warnings: modelWarnings(canonicalModel, appliedMigrations)
  };
}

export function parseModelJson(raw) {
  if (typeof raw !== 'string') {
    throw new ModelImportError('INVALID_JSON_INPUT', 'El contenido del modelo debe ser texto JSON.');
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ModelImportError('INVALID_JSON', `El archivo no contiene JSON válido: ${error.message}`);
  }
}

export function prepareModelJsonImport(raw) {
  return prepareModelImport(parseModelJson(raw));
}
