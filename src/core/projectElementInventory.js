import {
  getElementShortLabel,
  getOpeningDisplayName,
  getWallDisplayName
} from './naming.js';

const TYPE_LABELS = Object.freeze({
  wall: 'Muro',
  column: 'Pilar',
  beam: 'Viga',
  foundation: 'Fundación',
  door: 'Puerta',
  window: 'Ventana'
});

const LIBRARY_KEYS = Object.freeze({
  wall: 'wallSections',
  column: 'columnSections',
  beam: 'beamSections',
  foundation: 'foundationSections',
  door: 'openingTemplates',
  window: 'openingTemplates'
});

function levelName(grid, id) {
  const level = (grid?.zLevels || []).find((candidate) => candidate.id === id);
  return level?.label ?? level?.name ?? (id != null ? String(id) : '—');
}

function levelInfo(element, grid, parent = null) {
  const source = parent || element;
  const ids = source.type === 'wall' || source.type === 'column'
    ? [source.bottomZ, source.topZ].filter((id) => id != null)
    : [source.levelZ].filter((id) => id != null);
  const uniqueIds = [...new Set(ids)];
  return {
    levelIds: uniqueIds,
    levelLabel: uniqueIds.length > 0
      ? uniqueIds.map((id) => levelName(grid, id)).join(' → ')
      : '—'
  };
}

function sectionLabel(element, library = {}) {
  const key = LIBRARY_KEYS[element.type];
  if (!key || element.libraryId == null) return '—';
  return (library[key] || []).find((item) => item.id === element.libraryId)?.name ?? '—';
}

function elementLabel(element, grid, parent = null) {
  if (parent) return getOpeningDisplayName(element, parent, grid);
  if (element.type === 'wall') return getWallDisplayName(element, grid);
  return getElementShortLabel(element, grid);
}

function wallTypeInfo(element, wallTypes) {
  if (element.type !== 'wall') {
    return {
      wallTypeId: null,
      wallTypeName: null,
      wallRole: null,
      wallTypeLabel: '—'
    };
  }
  if (element.wallTypeId == null) {
    return {
      wallTypeId: null,
      wallTypeName: null,
      wallRole: null,
      wallTypeLabel: 'Sin tipo / rol'
    };
  }
  const wallType = wallTypes.find((candidate) => candidate.id === element.wallTypeId);
  return {
    wallTypeId: element.wallTypeId,
    wallTypeName: wallType?.name ?? `Tipo inexistente (${element.wallTypeId})`,
    wallRole: wallType?.role ?? null,
    wallTypeLabel: wallType
      ? `${wallType.name} · ${wallType.role}`
      : `Tipo inexistente (${element.wallTypeId})`
  };
}

function elementStatuses(element) {
  const statuses = [];
  if (element.type === 'wall' && element.wallTypeId == null) statuses.push('untyped-wall');
  if (element.type === 'wall' && element.studsStale === true) statuses.push('stale-framing');
  if (element.type === 'wall' && element.osbStale === true) statuses.push('stale-osb');
  return statuses;
}

function rowFromElement(element, model, parent = null) {
  const statuses = parent ? [] : elementStatuses(element);
  const levels = levelInfo(element, model.grid, parent);
  const wallType = wallTypeInfo(element, model.wallTypes || []);
  const typeLabel = TYPE_LABELS[element.type] ?? element.type;
  const label = elementLabel(element, model.grid, parent);
  const section = sectionLabel(element, model.library);
  const status = statuses[0] ?? 'complete';
  return {
    key: parent
      ? `opening:${String(parent.id)}:${String(element.id)}`
      : `element:${String(element.id)}`,
    id: element.id,
    parentId: parent?.id ?? null,
    type: element.type,
    typeLabel,
    label,
    sectionLabel: section,
    ...levels,
    ...wallType,
    statuses,
    status,
    searchText: [
      element.id,
      typeLabel,
      label,
      section,
      levels.levelLabel,
      wallType.wallTypeLabel
    ].join(' ').toLocaleLowerCase('es')
  };
}

/** Proyección de sólo lectura; conserva el orden persistido y ubica cada vano tras su muro. */
export function buildProjectElementInventory(model) {
  const rows = [];
  for (const element of model?.elements || []) {
    rows.push(rowFromElement(element, model));
    if (element.type !== 'wall') continue;
    for (const opening of element.openings || []) {
      rows.push(rowFromElement(opening, model, element));
    }
  }
  return rows;
}

function normalizeQuery(value) {
  return String(value ?? '').trim().toLocaleLowerCase('es');
}

/** Filtros puros combinables; nunca ordena ni modifica las filas recibidas. */
export function filterProjectElementRows(rows, filters = {}) {
  const query = normalizeQuery(filters.query);
  const type = filters.type ?? 'all';
  const levelId = filters.levelId ?? 'all';
  const status = filters.status ?? 'all';
  return rows.filter((row) => (
    (query === '' || row.searchText.includes(query))
    && (type === 'all' || row.type === type)
    && (levelId === 'all' || row.levelIds.includes(levelId))
    && (status === 'all' || row.statuses.includes(status) || row.status === status)
  ));
}
