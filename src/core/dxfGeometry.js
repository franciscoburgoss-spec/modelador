// Geometría pura para las entidades DXF simples que emiten los exportadores.
// No conoce React, Tauri ni el modelo: sólo strings de pares código/valor.

export const DXF_PAPER_MARGIN_MM = 3;

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDxfRecords(entityText) {
  const tokens = String(entityText).split('\n');
  const records = [];
  let current = null;
  for (let index = 0; index + 1 < tokens.length; index += 2) {
    const code = tokens[index].trim();
    const value = tokens[index + 1];
    if (code === '0') {
      current = { type: value.trim(), fields: new Map() };
      records.push(current);
      continue;
    }
    if (!current) continue;
    if (!current.fields.has(code)) current.fields.set(code, []);
    current.fields.get(code).push(value);
  }
  return records;
}

function lastField(record, code) {
  return record.fields.get(code)?.at(-1);
}

function decodedTextLength(text) {
  return String(text).replace(/%%[DPC]/gi, 'O');
}

/** Estimación conservadora para `txt.shx`: se usa para reservar espacio, nunca para tipografía. */
export function estimateDxfTextWidth(text, height) {
  const h = finite(height);
  if (!(h >= 0)) return Number.NaN;
  let units = 0;
  for (const char of decodedTextLength(text)) {
    if (char === ' ') units += 0.55;
    else if (/[I1.,:;'|!ijl]/.test(char)) units += 0.5;
    else if (/[MW@%#]/.test(char)) units += 1.15;
    else if (/[0-9]/.test(char)) units += 0.75;
    else units += 0.9;
  }
  return units * h * 1.05;
}

function emptyBounds() {
  return { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
}

function addPoint(bounds, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  bounds.xMin = Math.min(bounds.xMin, x);
  bounds.xMax = Math.max(bounds.xMax, x);
  bounds.yMin = Math.min(bounds.yMin, y);
  bounds.yMax = Math.max(bounds.yMax, y);
}

export function isFiniteDxfBounds(bounds) {
  return Boolean(bounds)
    && Object.values(bounds).every(Number.isFinite)
    && bounds.xMax >= bounds.xMin
    && bounds.yMax >= bounds.yMin;
}

function recordBounds(record) {
  const bounds = emptyBounds();
  if (record.type === 'TEXT') {
    const x = finite(lastField(record, '10'));
    const y = finite(lastField(record, '20'));
    const height = finite(lastField(record, '40'));
    const rotation = finite(lastField(record, '50')) ?? 0;
    const width = estimateDxfTextWidth(lastField(record, '1') ?? '', height);
    if (x === null || y === null || !(height >= 0) || !Number.isFinite(width)) return bounds;
    const radians = rotation * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    for (const [localX, localY] of [[0, 0], [width, 0], [0, height], [width, height]]) {
      addPoint(bounds, x + localX * cos - localY * sin, y + localX * sin + localY * cos);
    }
    return bounds;
  }

  if (record.type === 'CIRCLE') {
    const x = finite(lastField(record, '10'));
    const y = finite(lastField(record, '20'));
    const radius = finite(lastField(record, '40'));
    if (x === null || y === null || !(radius >= 0)) return bounds;
    addPoint(bounds, x - radius, y - radius);
    addPoint(bounds, x + radius, y + radius);
    return bounds;
  }

  for (const code of ['10', '11', '12', '13']) {
    const xValues = record.fields.get(code) ?? [];
    const yValues = record.fields.get(String(Number(code) + 10)) ?? [];
    const count = Math.min(xValues.length, yValues.length);
    for (let index = 0; index < count; index += 1) {
      addPoint(bounds, finite(xValues[index]), finite(yValues[index]));
    }
  }
  return bounds;
}

export function unionDxfBounds(boundsList) {
  const result = emptyBounds();
  for (const bounds of boundsList) {
    if (!isFiniteDxfBounds(bounds)) continue;
    addPoint(result, bounds.xMin, bounds.yMin);
    addPoint(result, bounds.xMax, bounds.yMax);
  }
  return result;
}

export function dxfEntityBounds(entityText) {
  return unionDxfBounds(parseDxfRecords(entityText).map(recordBounds));
}

export function expandDxfBounds(bounds, amount) {
  if (!isFiniteDxfBounds(bounds) || !Number.isFinite(amount) || amount < 0) return emptyBounds();
  return {
    xMin: bounds.xMin - amount,
    xMax: bounds.xMax + amount,
    yMin: bounds.yMin - amount,
    yMax: bounds.yMax + amount
  };
}

export function unionDxfEntityBounds(entities, options = {}) {
  const {
    padding = 0,
    paperMargin = 0,
    scale = 1
  } = options;
  const raw = unionDxfBounds(entities.map(dxfEntityBounds));
  const margin = padding + paperMargin * scale;
  if (!isFiniteDxfBounds(raw)) {
    return { xMin: -margin, xMax: margin, yMin: -margin, yMax: margin };
  }
  return expandDxfBounds(raw, margin);
}

export function dxfBoundsContain(outer, inner, tolerance = 0.01) {
  return isFiniteDxfBounds(outer)
    && isFiniteDxfBounds(inner)
    && inner.xMin >= outer.xMin - tolerance
    && inner.xMax <= outer.xMax + tolerance
    && inner.yMin >= outer.yMin - tolerance
    && inner.yMax <= outer.yMax + tolerance;
}

function overlapArea(a, b) {
  const width = Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin);
  const height = Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin);
  return width > 0 && height > 0 ? width * height : 0;
}

function circleData(record) {
  if (record.type !== 'CIRCLE') return null;
  const x = finite(lastField(record, '10'));
  const y = finite(lastField(record, '20'));
  const radius = finite(lastField(record, '40'));
  return x === null || y === null || !(radius >= 0) ? null : { x, y, radius };
}

/** Sólo reporta pares cuya resolución está prevista por R9-B/R9-C. */
export function findDxfCollisions(entities, tolerance = 0.01) {
  const items = entities.flatMap((entity, entityIndex) =>
    parseDxfRecords(entity).map((record) => ({
      entityIndex,
      type: record.type,
      bounds: recordBounds(record),
      circle: circleData(record)
    }))
  ).filter((item) => (
    (item.type === 'TEXT' || item.type === 'CIRCLE')
    && isFiniteDxfBounds(item.bounds)
  ));

  const collisions = [];
  for (let first = 0; first < items.length; first += 1) {
    for (let second = first + 1; second < items.length; second += 1) {
      const a = items[first];
      const b = items[second];
      if (a.type === 'TEXT' && b.type === 'TEXT') {
        const area = overlapArea(a.bounds, b.bounds);
        if (area > tolerance) collisions.push({ kind: 'text-text', first: a.entityIndex, second: b.entityIndex, area });
      } else if (a.circle && b.circle) {
        const distance = Math.hypot(a.circle.x - b.circle.x, a.circle.y - b.circle.y);
        if (distance + tolerance < a.circle.radius + b.circle.radius) {
          collisions.push({ kind: 'circle-circle', first: a.entityIndex, second: b.entityIndex });
        }
      }
    }
  }
  return collisions;
}
