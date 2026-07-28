// Contratos puros para entradas y resultados CalculiX. No ejecuta procesos ni toca filesystem.

const NUMBER_TOKEN = /[+-]?(?:NaN|Infinity|(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)/gi;
const DISPLACEMENT_COMPONENTS = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'];

function parseHeader(line) {
  const parts = line.slice(1).split(',').map((part) => part.trim());
  const keyword = parts.shift().toUpperCase();
  const parameters = {};
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator < 0) parameters[part.toUpperCase()] = true;
    else {
      parameters[part.slice(0, separator).trim().toUpperCase()] = (
        part.slice(separator + 1).trim().toUpperCase()
      );
    }
  }
  return { keyword, parameters };
}

function numericTokens(line) {
  return [...String(line).matchAll(NUMBER_TOKEN)].map((match) => Number(match[0]));
}

function addNsetData(target, values, generate) {
  if (!generate) {
    for (const id of values) if (Number.isInteger(id)) target.add(id);
    return;
  }
  const [start, end, increment = 1] = values;
  if (![start, end, increment].every(Number.isInteger) || increment <= 0) return;
  for (let id = start; id <= end; id += increment) target.add(id);
}

/** Extrae nodos, sets y referencias de sección sin interpretar geometría ni cargas. */
export function parseCalculixInpContract(inpText) {
  const nodeIds = new Set();
  const elementSets = new Set();
  const nodeSets = new Map();
  const sectionReferences = [];
  let current = null;

  for (const rawLine of String(inpText || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('**')) continue;
    if (line.startsWith('*')) {
      current = parseHeader(line);
      const elset = current.parameters.ELSET;
      const nset = current.parameters.NSET;
      if (elset && ['ELEMENT', 'ELSET'].includes(current.keyword)) elementSets.add(elset);
      if (nset && !nodeSets.has(nset)) nodeSets.set(nset, new Set());
      if (current.keyword.endsWith('SECTION') && elset) {
        sectionReferences.push({ keyword: current.keyword, elset });
      }
      continue;
    }

    const values = numericTokens(line);
    if (current?.keyword === 'NODE' && Number.isInteger(values[0])) {
      nodeIds.add(values[0]);
    }
    if (current?.keyword === 'NSET' && current.parameters.NSET) {
      addNsetData(
        nodeSets.get(current.parameters.NSET),
        values,
        Boolean(current.parameters.GENERATE)
      );
    }
  }

  const unresolvedSectionReferences = sectionReferences.filter(
    ({ elset }) => !elementSets.has(elset)
  );
  const allSetNames = [...elementSets, ...nodeSets.keys()];
  return {
    nodeIds,
    nodeSets,
    elementSets,
    sectionReferences,
    unresolvedSectionReferences,
    maxSetNameLength: allSetNames.reduce(
      (maximum, name) => Math.max(maximum, name.length),
      0
    )
  };
}

/** Valida las precondiciones estáticas que CCX puede aceptar falsamente con código cero. */
export function assertCalculixInpContract(inpText, options = {}) {
  const contract = parseCalculixInpContract(inpText);
  const maxSetNameLength = options.maxSetNameLength ?? 20;
  const longNames = [...contract.elementSets, ...contract.nodeSets.keys()]
    .filter((name) => name.length > maxSetNameLength);
  if (contract.nodeIds.size === 0) {
    throw new Error('El INP no declara nodos.');
  }
  if (longNames.length > 0) {
    throw new Error(`Sets CalculiX mayores a ${maxSetNameLength}: ${longNames.join(', ')}.`);
  }
  if (contract.unresolvedSectionReferences.length > 0) {
    throw new Error(
      `Secciones con ELSET inexistente: ${contract.unresolvedSectionReferences
        .map(({ elset }) => elset)
        .join(', ')}.`
    );
  }
  return contract;
}

/** Lee el último bloque DISP de un FRD y conserva las seis componentes cuando existen. */
export function parseCalculixFrdDisplacements(frdText) {
  const displacements = new Map();
  let inDisplacementBlock = false;
  for (const rawLine of String(frdText || '').split(/\r?\n/)) {
    if (/^\s*-4\s+DISP\b/i.test(rawLine)) {
      displacements.clear();
      inDisplacementBlock = true;
      continue;
    }
    if (!inDisplacementBlock) continue;
    if (/^\s*-(?:3|4)\b/.test(rawLine)) {
      inDisplacementBlock = false;
      continue;
    }
    if (!/^\s*-1\b/.test(rawLine)) continue;
    const values = numericTokens(rawLine);
    const id = values[1];
    if (!Number.isInteger(id)) continue;
    const components = {};
    values.slice(2, 8).forEach((value, index) => {
      components[DISPLACEMENT_COMPONENTS[index]] = value;
    });
    displacements.set(id, components);
  }
  return displacements;
}

/** Lee el último bloque `displacements` de un DAT. */
export function parseCalculixDatDisplacements(datText) {
  const displacements = new Map();
  let inBlock = false;
  for (const rawLine of String(datText || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^displacements\b/i.test(line)) {
      displacements.clear();
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (line === '') continue;
    const values = numericTokens(line);
    if (!/^\d/.test(line) || values.length < 4) {
      inBlock = false;
      continue;
    }
    const [id, ux, uy, uz] = values;
    if (!Number.isInteger(id)) continue;
    displacements.set(id, { ux, uy, uz });
  }
  return displacements;
}

/** Exige correspondencia exacta con los nodos esperados y devuelve extremos reproducibles. */
export function assertCalculixDisplacements(displacements, expectedNodeIds) {
  const expected = new Set(expectedNodeIds || []);
  if (expected.size === 0) throw new Error('No hay nodos esperados para validar resultados.');
  if (!(displacements instanceof Map) || displacements.size === 0) {
    throw new Error('CalculiX no produjo desplazamientos.');
  }

  const actual = new Set(displacements.keys());
  const missingNodeIds = [...expected].filter((id) => !actual.has(id));
  const alienNodeIds = [...actual].filter((id) => !expected.has(id));
  if (missingNodeIds.length > 0 || alienNodeIds.length > 0) {
    throw new Error(
      `Nodos de resultado inválidos; faltan=[${missingNodeIds.join(',')}], `
      + `ajenos=[${alienNodeIds.join(',')}].`
    );
  }

  const extrema = {};
  let valueCount = 0;
  let maxAbs = 0;
  for (const [nodeId, components] of displacements) {
    const entries = Object.entries(components);
    if (entries.length < 3 || !['ux', 'uy', 'uz'].every((name) => name in components)) {
      throw new Error(`Nodo ${nodeId}: bloque de desplazamientos incompleto.`);
    }
    for (const [name, value] of entries) {
      if (!Number.isFinite(value)) {
        throw new Error(`Nodo ${nodeId}: desplazamiento ${name} no finito.`);
      }
      valueCount++;
      maxAbs = Math.max(maxAbs, Math.abs(value));
      const previous = extrema[name] || { min: Infinity, max: -Infinity };
      extrema[name] = {
        min: Math.min(previous.min, value),
        max: Math.max(previous.max, value)
      };
    }
  }

  return { nodeCount: displacements.size, valueCount, maxAbs, extrema };
}

function diagnosticLines(output, level) {
  const pattern = new RegExp(`^\\s*\\*${level}\\b`, 'i');
  return String(output || '')
    .split(/\r?\n/)
    .filter((line) => pattern.test(line))
    .map((line) => line.trim().replace(/\s+/g, ' '));
}

/** CCX puede imprimir `Job finished` y devolver cero junto con errores de lectura. */
export function assertCalculixSolverCompletion(
  { status, stdout = '', stderr = '' },
  options = {}
) {
  const output = `${stdout}\n${stderr}`;
  const errors = diagnosticLines(output, 'ERROR');
  const warnings = diagnosticLines(output, 'WARNING');
  const allowedWarnings = new Set(options.allowedWarnings || []);
  const unexpectedWarnings = warnings.filter((warning) => !allowedWarnings.has(warning));

  if (status !== 0) throw new Error(`CalculiX terminó con código ${status}.`);
  if (!/\bJob finished\b/.test(stdout)) {
    throw new Error('CalculiX no informó Job finished.');
  }
  if (errors.length > 0) {
    throw new Error(`CalculiX informó errores: ${errors.join(' | ')}`);
  }
  if (unexpectedWarnings.length > 0) {
    throw new Error(
      `CalculiX informó warnings no permitidos: ${unexpectedWarnings.join(' | ')}`
    );
  }
  return { finished: true, warnings };
}

/** Agrega la sonda cinemática del arnés sin modificar ningún byte del prefijo fuente. */
export function appendCalculixKinematicProbe(inpText, options = {}) {
  const source = String(inpText || '');
  const contract = assertCalculixInpContract(source);
  if (/\n\s*\*STEP\b/i.test(`\n${source}`)) {
    throw new Error('La sonda global sólo puede agregarse a un INP sin STEP.');
  }
  const nsetName = String(options.nsetName || 'SMOKE_GLOBAL').toUpperCase();
  if (!/^[A-Z][A-Z0-9_]*$/.test(nsetName) || nsetName.length > 20) {
    throw new Error(`NSET de sonda inválido: ${nsetName}.`);
  }
  const nodeIds = [...contract.nodeIds].sort((left, right) => left - right);
  const rows = [];
  for (let index = 0; index < nodeIds.length; index += 16) {
    rows.push(nodeIds.slice(index, index + 16).join(', '));
  }
  const separator = source.endsWith('\n') ? '' : '\n';
  const suffix = [
    '** Sonda cinematica SPEC-003-C2: sin carga ni interpretacion estructural.',
    `*NSET, NSET=${nsetName}`,
    ...rows,
    '*BOUNDARY',
    `${nsetName}, 1, 6`,
    '*STEP',
    '*STATIC',
    `*NODE FILE, NSET=${nsetName}`,
    'U',
    '*END STEP',
    ''
  ].join('\n');
  return `${source}${separator}${suffix}`;
}
