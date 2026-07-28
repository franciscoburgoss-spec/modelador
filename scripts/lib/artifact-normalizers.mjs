import { createHash } from 'node:crypto';

export const NORMALIZATION_CONTRACT = {
  schemaVersion: 1,
  identifiers: {
    normalized: [],
    preserved: [
      'model element/axis/profile/type/roof/opening IDs and references',
      'DXF handles, owners, block and layout references',
      'CalculiX node IDs, element IDs, NSET and ELSET names'
    ]
  },
  timestamps: {
    normalized: [],
    fixedInputs: [
      {
        path: 'projectInfo.fecha for reference sheets',
        value: '2026-07-28'
      }
    ]
  },
  order: {
    normalized: [
      'JSON object-key order',
      'CSV takeoff row order after grouping',
      'DXF record order in the semantic hash',
      'summary map/set order'
    ],
    preserved: [
      'JSON array order',
      'DXF group-code order inside each record',
      'INP keyword and data-line order',
      'node and element connectivity'
    ]
  },
  text: {
    lineEndings: 'LF',
    terminalLineFeed: true,
    inpComments: 'excluded except unit declarations and ADVERTENCIA lines'
  }
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sortedObject(entries) {
  return Object.fromEntries(
    [...entries].sort(([left], [right]) => left.localeCompare(right))
  );
}

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) {
    const key = String(keyOf(item));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return sortedObject(counts);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function ownState(object, key) {
  return Object.hasOwn(object, key) ? object[key] : 'absent';
}

function finiteSum(items, valueOf) {
  return items.reduce((total, item) => {
    const value = Number(valueOf(item));
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function summarizeJson(content) {
  const model = JSON.parse(content);
  const elements = model.elements || [];
  const walls = elements.filter((element) => element.type === 'wall');
  const openings = walls.flatMap((wall) => wall.openings || []);
  const roofPlanes = model.roofPlanes || [];

  return {
    modelVersion: model.modelVersion,
    semanticSha256: sha256(canonicalJson(model)),
    axes: {
      x: (model.grid?.xAxes || []).map(({ id, position, label }) => ({ id, position, label })),
      y: (model.grid?.yAxes || []).map(({ id, position, label }) => ({ id, position, label })),
      z: (model.grid?.zLevels || []).map(({ id, elevation, label }) => ({ id, elevation, label }))
    },
    units: {
      geometry: 'mm',
      parameters: (model.projectParams || []).map(({ id, name, value, unit }) => ({
        id: id ?? null,
        name,
        value,
        unit: unit ?? null
      }))
    },
    counts: {
      elements: countBy(elements, (element) => element.type),
      openings: countBy(openings, (opening) => opening.type),
      wallTypes: (model.wallTypes || []).length,
      profiles: (model.library?.metalconProfiles || []).length,
      roofPlanes: roofPlanes.length,
      roofSystemsPersisted: (model.roofSystems || []).length
    },
    references: {
      walls: walls.map((wall) => ({
        id: wall.id,
        wallTypeId: wall.wallTypeId ?? null,
        xStart: wall.xStart,
        xEnd: wall.xEnd,
        yStart: wall.yStart,
        yEnd: wall.yEnd,
        bottomZ: wall.bottomZ,
        topZ: wall.topZ,
        framingStudProfileId: wall.framingStudProfileId ?? null,
        framingTrackProfileId: wall.framingTrackProfileId ?? null
      })),
      wallTypes: (model.wallTypes || []).map((wallType) => ({
        id: wallType.id,
        role: wallType.role,
        studProfileId: wallType.metalconDefaults?.studProfileId ?? null,
        trackProfileId: wallType.metalconDefaults?.trackProfileId ?? null
      })),
      roofPlanes: roofPlanes.map((plane) => ({
        id: plane.id,
        canalWallId: plane.canalWallId,
        supportLevelId: plane.supportLevelId,
        templateId: plane.templateId,
        supportProfile: plane.supportProfile,
        profiles: plane.profiles
      }))
    },
    magnitudes: {
      wallThickness: walls.map((wall) => ({ id: wall.id, value: wall.thickness })),
      openingWidths: openings.map((opening) => ({ id: opening.id, value: opening.width })),
      roofPlanePolygons: roofPlanes.map((plane) => ({
        id: plane.id,
        polygon: plane.polygon
      }))
    },
    derived: walls.map((wall) => {
      const studs = wall.studs || [];
      const panels = (wall.osbCourses || []).flatMap((course) => course.panels || []);
      return {
        wallId: wall.id,
        studsStale: ownState(wall, 'studsStale'),
        osbStale: ownState(wall, 'osbStale'),
        studRoles: countBy(studs, (piece) => piece.role),
        studLengthMm: finiteSum(studs, (piece) => piece.zMax - piece.zMin),
        headers: (wall.headers || []).length,
        osbPanels: panels.length,
        osbAreaMm2: finiteSum(panels, (panel) => panel.width * panel.height)
      };
    })
  };
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV de referencia con comillas sin cerrar.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function numericOrText(value) {
  if (value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

export function summarizeCsv(content) {
  const rows = parseCsv(content);
  const status = rows[0] || [];
  const header = rows[1] || [];
  const takeoffRows = [];
  let index = 2;
  for (; index < rows.length && rows[index].some((value) => value !== ''); index++) {
    takeoffRows.push(Object.fromEntries(
      header.map((column, columnIndex) => [
        column,
        numericOrText(rows[index][columnIndex] ?? '')
      ])
    ));
  }
  takeoffRows.sort((left, right) => (
    `${left.Tipo}\0${left.Sección}`.localeCompare(`${right.Tipo}\0${right.Sección}`)
  ));

  const annex = {};
  for (; index < rows.length; index++) {
    const row = rows[index];
    if (row.length === 0 || row.every((value) => value === '')) continue;
    if (row.length === 1) {
      annex.title = row[0];
    } else {
      annex[row[0]] = row.slice(1).map(numericOrText);
    }
  }

  const semantic = {
    status: status[1] ?? null,
    columns: header,
    rows: takeoffRows,
    annex: canonicalize(annex)
  };
  return {
    ...semantic,
    rowCount: takeoffRows.length,
    units: ['Cantidad', 'ml', 'm2', 'm3'],
    semanticSha256: sha256(canonicalJson(semantic))
  };
}

function parseDxfPairs(content) {
  const lines = content.replace(/\n$/, '').split('\n');
  if (lines.length % 2 !== 0) {
    throw new Error(`DXF con cantidad impar de líneas: ${lines.length}.`);
  }
  const pairs = [];
  for (let index = 0; index < lines.length; index += 2) {
    const code = Number(lines[index].trim());
    if (!Number.isInteger(code)) throw new Error(`Código DXF inválido: ${lines[index]}.`);
    pairs.push({ code, value: lines[index + 1].trim() });
  }
  return pairs;
}

function parseDxfRecords(pairs) {
  const records = [];
  let section = null;
  let index = 0;
  while (index < pairs.length) {
    const pair = pairs[index];
    if (pair.code === 0 && pair.value === 'SECTION') {
      section = pairs[index + 1]?.code === 2 ? pairs[index + 1].value : null;
      index += 2;
      continue;
    }
    if (pair.code === 0 && pair.value === 'ENDSEC') {
      section = null;
      index++;
      continue;
    }
    if (pair.code !== 0) {
      index++;
      continue;
    }
    const fields = [];
    let cursor = index + 1;
    while (cursor < pairs.length && pairs[cursor].code !== 0) {
      fields.push(pairs[cursor]);
      cursor++;
    }
    records.push({ section, type: pair.value, fields });
    index = cursor;
  }
  return records;
}

function fieldValues(record, code) {
  return record.fields.filter((field) => field.code === code).map((field) => field.value);
}

function firstField(record, code) {
  return fieldValues(record, code)[0] ?? null;
}

function includePoint(extent, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  extent.minX = Math.min(extent.minX, x);
  extent.minY = Math.min(extent.minY, y);
  extent.maxX = Math.max(extent.maxX, x);
  extent.maxY = Math.max(extent.maxY, y);
}

function updateDxfExtent(extent, record) {
  for (const xCode of [10, 11, 12, 13, 14, 15, 16, 17, 18, 110, 111, 112, 113, 114, 115, 116, 117, 118]) {
    const xs = fieldValues(record, xCode).map(Number);
    const ys = fieldValues(record, xCode + 10).map(Number);
    for (let index = 0; index < Math.min(xs.length, ys.length); index++) {
      includePoint(extent, xs[index], ys[index]);
    }
  }
  if (record.type === 'CIRCLE') {
    const x = Number(firstField(record, 10));
    const y = Number(firstField(record, 20));
    const radius = Number(firstField(record, 40));
    includePoint(extent, x - radius, y - radius);
    includePoint(extent, x + radius, y + radius);
  }
}

function finalExtent(extent) {
  if (!Number.isFinite(extent.minX)) return null;
  return Object.fromEntries(
    Object.entries(extent).map(([key, value]) => [key, Number(value.toFixed(3))])
  );
}

function dxfRecordSignature(record) {
  return JSON.stringify([
    record.section,
    record.type,
    record.fields.map(({ code, value }) => [code, value])
  ]);
}

export function summarizeDxf(content) {
  const pairs = parseDxfPairs(content);
  const records = parseDxfRecords(pairs);
  const declaredVersionIndex = pairs.findIndex(
    (pair) => pair.code === 9 && pair.value === '$ACADVER'
  );
  const entities = records.filter((record) => record.section === 'ENTITIES');
  const blockEntities = records.filter((record) => (
    record.section === 'BLOCKS' && !['BLOCK', 'ENDBLK'].includes(record.type)
  ));
  const layerRecords = records.filter((record) => (
    record.section === 'TABLES' && record.type === 'LAYER'
  ));
  const layerNames = new Set(
    layerRecords.map((record) => firstField(record, 2)).filter(Boolean)
  );
  const layerUsage = new Map();
  const textCounts = new Map();
  const extent = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };

  for (const record of entities) {
    const layer = firstField(record, 8) || '0';
    layerNames.add(layer);
    layerUsage.set(layer, (layerUsage.get(layer) || 0) + 1);
    updateDxfExtent(extent, record);
    if (['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'].includes(record.type)) {
      const text = [...fieldValues(record, 3), ...fieldValues(record, 1)].join('');
      textCounts.set(text, (textCounts.get(text) || 0) + 1);
    }
  }

  const layoutNames = records
    .filter((record) => record.section === 'OBJECTS' && record.type === 'LAYOUT')
    .map((record) => firstField(record, 1))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const semanticRecords = records
    .filter((record) => record.type !== 'EOF')
    .map(dxfRecordSignature)
    .sort((left, right) => left.localeCompare(right));

  return {
    version: declaredVersionIndex >= 0
      ? pairs[declaredVersionIndex + 1]?.value
      : 'AC1009-implicit',
    layouts: layoutNames.length > 0 ? layoutNames : ['Model'],
    layers: [...layerNames].sort((left, right) => left.localeCompare(right)),
    entityTypes: countBy(entities, (record) => record.type),
    blockEntityTypes: countBy(blockEntities, (record) => record.type),
    layerEntityCounts: sortedObject(layerUsage),
    spaces: countBy(entities, (record) => (
      firstField(record, 67) === '1' ? 'paper' : 'model'
    )),
    extents: finalExtent(extent),
    texts: sortedObject(textCounts),
    semanticSha256: sha256(semanticRecords.join('\n'))
  };
}

function parseInpHeader(line) {
  const parts = line.slice(1).split(',').map((part) => part.trim());
  const keyword = parts.shift().toUpperCase();
  const parameters = {};
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator < 0) parameters[part.toUpperCase()] = true;
    else {
      parameters[part.slice(0, separator).trim().toUpperCase()] = (
        part.slice(separator + 1).trim()
      );
    }
  }
  return { keyword, parameters };
}

function numericRowsExtent(rows) {
  if (rows.length === 0) return null;
  const xs = rows.map((row) => Number(row[1]));
  const ys = rows.map((row) => Number(row[2]));
  const zs = rows.map((row) => Number(row[3]));
  if (![...xs, ...ys, ...zs].every(Number.isFinite)) return null;
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    minZ: Math.min(...zs),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    maxZ: Math.max(...zs)
  };
}

export function summarizeInp(content) {
  const keywordCounts = new Map();
  const materials = new Set();
  const nsets = new Set();
  const elsets = new Set();
  const elementTypes = new Map();
  const nodeRows = [];
  const elementRows = [];
  const boundaryRows = [];
  const loadRows = [];
  const unitDeclarations = [];
  const warnings = [];
  const semanticLines = [];
  let nonFiniteTokens = 0;
  let current = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (line.startsWith('**')) {
      if (/unidades/i.test(line)) unitDeclarations.push(line.slice(2).trim());
      if (/ADVERTENCIA/i.test(line)) warnings.push(line.slice(2).trim());
      continue;
    }
    semanticLines.push(line);
    nonFiniteTokens += (line.match(/(?:^|[\s,])(?:NaN|[+-]?Infinity)(?=$|[\s,])/g) || []).length;
    if (line.startsWith('*')) {
      current = parseInpHeader(line);
      keywordCounts.set(
        current.keyword,
        (keywordCounts.get(current.keyword) || 0) + 1
      );
      if (current.keyword === 'MATERIAL' && current.parameters.NAME) {
        materials.add(current.parameters.NAME);
      }
      if (current.parameters.NSET) nsets.add(current.parameters.NSET);
      if (current.parameters.ELSET) elsets.add(current.parameters.ELSET);
      if (current.keyword === 'ELEMENT') {
        const type = current.parameters.TYPE || 'UNDECLARED';
        elementTypes.set(type, (elementTypes.get(type) || 0));
      }
      continue;
    }
    const values = line.split(',').map((value) => value.trim());
    if (current?.keyword === 'NODE') nodeRows.push(values);
    if (current?.keyword === 'ELEMENT') {
      elementRows.push(values);
      const type = current.parameters.TYPE || 'UNDECLARED';
      elementTypes.set(type, (elementTypes.get(type) || 0) + 1);
    }
    if (current?.keyword === 'BOUNDARY') boundaryRows.push(values);
    if (['CLOAD', 'DLOAD'].includes(current?.keyword)) loadRows.push(values);
  }

  const nodeIds = nodeRows.map((row) => row[0]);
  const elementIds = elementRows.map((row) => row[0]);
  return {
    keywordCounts: sortedObject(keywordCounts),
    materials: [...materials].sort((left, right) => left.localeCompare(right)),
    nsets: [...nsets].sort((left, right) => left.localeCompare(right)),
    elsets: [...elsets].sort((left, right) => left.localeCompare(right)),
    elementTypes: sortedObject(elementTypes),
    nodes: {
      count: nodeRows.length,
      idsSha256: sha256(nodeIds.join('\n')),
      extents: numericRowsExtent(nodeRows)
    },
    elements: {
      count: elementRows.length,
      idsSha256: sha256(elementIds.join('\n')),
      connectivitySha256: sha256(elementRows.map((row) => row.join(',')).join('\n'))
    },
    boundaryRows: boundaryRows.length,
    loadRows: loadRows.length,
    nonFiniteTokens,
    unitDeclarations: [...unitDeclarations].sort((left, right) => left.localeCompare(right)),
    warnings: [...warnings].sort((left, right) => left.localeCompare(right)),
    semanticSha256: sha256(semanticLines.join('\n'))
  };
}

const NORMALIZERS = {
  json: summarizeJson,
  csv: summarizeCsv,
  dxf: summarizeDxf,
  inp: summarizeInp
};

export function buildGoldenDocuments(artifacts) {
  const documents = {};
  for (const format of Object.keys(NORMALIZERS)) {
    const formatArtifacts = artifacts
      .filter((artifact) => artifact.format === format)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((artifact) => ({
        id: artifact.id,
        family: artifact.family,
        variant: artifact.variant,
        sourceFixture: artifact.sourceFixture,
        filename: artifact.filename,
        lineEndings: artifact.content.includes('\r') ? 'CR_OR_CRLF' : 'LF',
        terminalLineFeed: artifact.content.endsWith('\n'),
        summary: NORMALIZERS[format](artifact.content)
      }));
    documents[format] = {
      schemaVersion: 1,
      format,
      normalizationContract: 'normalization-contract.json',
      artifacts: formatArtifacts
    };
  }
  return documents;
}
