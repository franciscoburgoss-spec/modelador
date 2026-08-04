export const SPEC14_SOURCE_SCHEMA = 'agnostic-geometry-v1.0';

const ELEMENT_TYPES = new Set(['wall', 'column', 'beam', 'foundation']);

export class Spec14InputError extends Error {
  constructor(code, message, { path = '$', ids = [] } = {}) {
    super(message);
    this.name = 'Spec14InputError';
    this.code = code;
    this.path = path;
    this.ids = [...new Set(ids)];
  }
}

function fail(code, message, path = '$', ids = []) {
  throw new Spec14InputError(code, message, { path, ids });
}

function requireArray(value, path) {
  if (!Array.isArray(value)) {
    fail('INVALID_COLLECTION', `${path} debe ser un arreglo.`, path);
  }
  return value;
}

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_OBJECT', `${path} debe ser un objeto.`, path);
  }
  return value;
}

function idKey(id) {
  return `${typeof id}:${JSON.stringify(id)}`;
}

function registerId(seen, id, path) {
  if (
    (typeof id !== 'string' && typeof id !== 'number')
    || id === ''
    || (typeof id === 'number' && !Number.isFinite(id))
  ) {
    fail('INVALID_ID', `${path} debe contener un ID string o number.`, path);
  }
  const key = idKey(id);
  if (seen.has(key)) {
    fail('DUPLICATE_ID', `El ID ${String(id)} no es único.`, path, [id]);
  }
  seen.set(key, path);
}

function assertFiniteGeometry(value, path, ids = []) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    fail('NON_FINITE_GEOMETRY', `${path} contiene un número no finito.`, path, ids);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteGeometry(item, `${path}[${index}]`, ids));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      assertFiniteGeometry(item, `${path}.${key}`, ids);
    });
  }
}

function validatePrism(prism, path, ids = [], { requirePositive = false } = {}) {
  requireObject(prism, path);
  if (!['oriented-prism', 'axis-aligned-prism'].includes(prism.kind)) {
    fail('INVALID_GEOMETRY', `${path} no declara un prisma compatible.`, `${path}.kind`, ids);
  }
  assertFiniteGeometry(prism, path, ids);
  if (!requirePositive) return;
  if (prism.kind === 'axis-aligned-prism') {
    const min = requireObject(prism.min, `${path}.min`);
    const max = requireObject(prism.max, `${path}.max`);
    if (!['x', 'y', 'z'].every((axis) => max[axis] > min[axis])) {
      fail('INVALID_DIMENSION', `${path} debe tener volumen positivo.`, path, ids);
    }
    return;
  }
  const start = requireObject(prism.start, `${path}.start`);
  const end = requireObject(prism.end, `${path}.end`);
  const span = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
  const breadth = prism.thickness ?? prism.width;
  if (!(span > 0 && breadth > 0 && prism.height > 0)) {
    fail('INVALID_DIMENSION', `${path} debe tener dimensiones positivas.`, path, ids);
  }
}

function validateElement(element, index, elementIdsByType, openingIds) {
  const path = `elements[${index}]`;
  requireObject(element, path);
  if (!ELEMENT_TYPES.has(element.type)) {
    fail(
      'UNKNOWN_ELEMENT_TYPE',
      `${path}.type no es compatible con SPEC-14.`,
      `${path}.type`,
      [element.id]
    );
  }
  registerId(elementIdsByType[element.type], element.id, `${path}.id`);
  if (element.type === 'foundation') {
    const solids = requireArray(element.solids, `${path}.solids`);
    if (solids.length === 0) {
      fail('INVALID_GEOMETRY', `${path}.solids no puede estar vacío.`, `${path}.solids`, [element.id]);
    }
    solids.forEach((solid, solidIndex) => {
      requireObject(solid, `${path}.solids[${solidIndex}]`);
      validatePrism(
        solid.prism,
        `${path}.solids[${solidIndex}].prism`,
        [element.id],
        { requirePositive: true }
      );
    });
    return;
  }
  validatePrism(element.prism, `${path}.prism`, [element.id], {
    requirePositive: element.type !== 'wall'
  });
  if (element.type !== 'wall') return;
  requireArray(element.openings, `${path}.openings`).forEach((opening, openingIndex) => {
    const openingPath = `${path}.openings[${openingIndex}]`;
    requireObject(opening, openingPath);
    registerId(openingIds, opening.id, `${openingPath}.id`);
    if (idKey(opening.hostWallId) !== idKey(element.id)) {
      fail(
        'UNRESOLVED_REFERENCE',
        `El vano ${String(opening.id)} no referencia a su muro contenedor.`,
        `${openingPath}.hostWallId`,
        [opening.id, opening.hostWallId]
      );
    }
    validatePrism(opening.void, `${openingPath}.void`, [opening.id, element.id]);
  });
}

export function consumeSpec14Input(input) {
  requireObject(input, '$');
  if (input.schema !== SPEC14_SOURCE_SCHEMA) {
    fail('INVALID_SCHEMA', `SPEC-14 requiere ${SPEC14_SOURCE_SCHEMA}.`, 'schema');
  }
  const grid = requireObject(input.grid, 'grid');
  const axisIds = new Map();
  const levelIds = new Map();
  for (const [collection, coordinate] of [
    ['xAxes', 'x'],
    ['yAxes', 'y'],
    ['zLevels', 'z']
  ]) {
    const seen = collection === 'zLevels' ? levelIds : axisIds;
    requireArray(grid[collection], `grid.${collection}`).forEach((entry, index) => {
      const path = `grid.${collection}[${index}]`;
      requireObject(entry, path);
      registerId(seen, entry.id, `${path}.id`);
      if (!Number.isFinite(entry[coordinate])) {
        fail('NON_FINITE_GEOMETRY', `${path}.${coordinate} debe ser finito.`, `${path}.${coordinate}`);
      }
    });
  }

  const elements = requireArray(input.elements, 'elements');
  const elementIdsByType = Object.fromEntries([...ELEMENT_TYPES].map((type) => [type, new Map()]));
  const openingIds = new Map();
  elements.forEach((element, index) => (
    validateElement(element, index, elementIdsByType, openingIds)
  ));
  const walls = elements.filter((element) => element.type === 'wall');
  if (walls.length === 0) {
    fail('MISSING_WALLS', 'SPEC-14 requiere al menos un elements[type=wall].', 'elements');
  }
  const roofGeometry = requireArray(input.roofGeometry ?? [], 'roofGeometry');
  const roofIds = new Map();
  roofGeometry.forEach((roof, index) => {
    const path = `roofGeometry[${index}]`;
    requireObject(roof, path);
    registerId(roofIds, roof.id, `${path}.id`);
    if (roof.surface?.kind !== 'planar-polygon') {
      fail('INVALID_GEOMETRY', `${path}.surface debe ser un polígono planar.`, `${path}.surface`);
    }
    const boundary = requireArray(roof.surface.boundary, `${path}.surface.boundary`);
    if (boundary.length < 3) {
      fail('INVALID_GEOMETRY', `${path}.surface.boundary requiere tres puntos.`, `${path}.surface.boundary`);
    }
    assertFiniteGeometry(boundary, `${path}.surface.boundary`);
  });

  return {
    grid,
    elements,
    walls,
    openings: walls.flatMap((wall) => wall.openings),
    foundations: elements.filter((element) => element.type === 'foundation'),
    roofGeometry
  };
}
