// Topología global y pura de encuentros entre muros.
//
// La autoridad se calcula por coordenadas de extremos y bandas Z. No persiste resultados ni
// conoce React/store/generadores: esos consumidores reciben una vista determinista por muro.

import { resolveWallGeometry, resolveWallLocalFrame } from './elementGeometry.js';
import { buildElementsById } from './elementReferences.js';
import { buildParamsMap } from './projectParams.js';

export const WALL_JUNCTION_TOLERANCE = 5;

const GEOMETRY_EPS = 1e-6;
const RAY_ORDER = ['W', 'E', 'S', 'N'];

function compareCodePoints(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function decimalInteger(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^[+-]?\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Orden total para IDs de muro. Los enteros decimales se comparan como enteros; los demás,
 * por código Unicode de su representación. El tipo sólo desempata representaciones idénticas
 * para no heredar la estabilidad del array de entrada en casos como 2 y "2".
 */
export function compareStableWallIds(a, b) {
  const integerA = decimalInteger(a);
  const integerB = decimalInteger(b);
  if (integerA !== null && integerB !== null && integerA !== integerB) {
    return integerA < integerB ? -1 : 1;
  }

  const textOrder = compareCodePoints(String(a), String(b));
  if (textOrder !== 0) return textOrder;
  return compareCodePoints(typeof a, typeof b);
}

function stableIdToken(id) {
  return `${typeof id}:${String(id)}`;
}

function sameId(a, b) {
  return typeof a === typeof b && Object.is(a, b);
}

function roundCoordinate(value) {
  return Math.round(value * 1000) / 1000;
}

function formatCoordinate(value) {
  const rounded = roundCoordinate(value);
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rayAxis(ray) {
  return ray === 'W' || ray === 'E' ? 'x' : 'y';
}

function sortRays(rays) {
  return [...rays].sort((a, b) => RAY_ORDER.indexOf(a) - RAY_ORDER.indexOf(b));
}

function raysForPosition(runAxis, position) {
  if (runAxis === 'x') {
    if (position === 'start') return ['E'];
    if (position === 'end') return ['W'];
    return ['W', 'E'];
  }
  if (position === 'start') return ['N'];
  if (position === 'end') return ['S'];
  return ['S', 'N'];
}

function findLevelElevation(grid, levelId) {
  const level = grid?.zLevels?.find((candidate) => candidate.id === levelId);
  const elevation = Number(level?.elevation);
  return Number.isFinite(elevation) ? elevation : null;
}

function resolveWalls(model, tolerance, options) {
  const elements = model?.elements || [];
  const grid = model?.grid || {};
  const paramsMap = options.paramsMap || buildParamsMap(model?.projectParams || []);
  const elementsById = options.elementsById || buildElementsById(elements);
  const resolved = [];
  const unresolved = [];

  for (const wall of elements.filter((element) => element?.type === 'wall')) {
    const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
    const frame = resolveWallLocalFrame(wall, geo);
    if (!frame) {
      unresolved.push({ wallId: wall.id, reason: 'unresolved-geometry' });
      continue;
    }
    if (!(frame.length > GEOMETRY_EPS)) {
      unresolved.push({ wallId: wall.id, reason: 'zero-length' });
      continue;
    }

    const crossAxis = frame.runAxis === 'x' ? 'y' : 'x';
    if (Math.abs(frame.end[crossAxis] - frame.origin[crossAxis]) > tolerance) {
      unresolved.push({ wallId: wall.id, reason: 'non-axis-aligned' });
      continue;
    }

    const bottom = findLevelElevation(grid, wall.bottomZ);
    const top = findLevelElevation(grid, wall.topZ);
    if (bottom === null || top === null || Math.abs(top - bottom) <= GEOMETRY_EPS) {
      unresolved.push({ wallId: wall.id, reason: 'unresolved-z-range' });
      continue;
    }

    resolved.push({
      wallId: wall.id,
      wall,
      geo,
      frame,
      runAxis: frame.runAxis,
      length: frame.length,
      absDx: Math.abs(frame.end.x - frame.origin.x),
      zMin: Math.min(bottom, top),
      zMax: Math.max(bottom, top)
    });
  }

  resolved.sort((a, b) => compareStableWallIds(a.wallId, b.wallId));
  unresolved.sort((a, b) => compareStableWallIds(a.wallId, b.wallId));
  return { resolved, unresolved };
}

function clusterEndpointCoordinates(resolvedWalls, tolerance) {
  const endpoints = resolvedWalls.flatMap((wall) => [
    { ...wall.frame.origin, wallId: wall.wallId, side: 'start' },
    { ...wall.frame.end, wallId: wall.wallId, side: 'end' }
  ]).sort((a, b) => (
    a.x - b.x
    || a.y - b.y
    || compareStableWallIds(a.wallId, b.wallId)
    || compareCodePoints(a.side, b.side)
  ));

  const parents = endpoints.map((_, index) => index);
  const find = (index) => {
    let cursor = index;
    while (parents[cursor] !== cursor) {
      parents[cursor] = parents[parents[cursor]];
      cursor = parents[cursor];
    }
    return cursor;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parents[rootB] = rootA;
  };

  for (let a = 0; a < endpoints.length; a++) {
    for (let b = a + 1; b < endpoints.length; b++) {
      if (endpoints[b].x - endpoints[a].x > tolerance) break;
      if (distance(endpoints[a], endpoints[b]) <= tolerance) union(a, b);
    }
  }

  const groups = new Map();
  endpoints.forEach((endpoint, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(endpoint);
  });

  return [...groups.values()].map((members) => ({
    x: roundCoordinate(members.reduce((sum, point) => sum + point.x, 0) / members.length),
    y: roundCoordinate(members.reduce((sum, point) => sum + point.y, 0) / members.length)
  })).sort((a, b) => a.x - b.x || a.y - b.y);
}

function participantAtPoint(resolvedWall, point, tolerance) {
  const { frame, runAxis, length } = resolvedWall;
  const crossAxis = runAxis === 'x' ? 'y' : 'x';
  if (Math.abs(point[crossAxis] - frame.origin[crossAxis]) > tolerance) return null;

  const rawOffset = point[runAxis] - frame.origin[runAxis];
  if (rawOffset < -tolerance || rawOffset > length + tolerance) return null;

  let position = 'body';
  let offset = Math.max(0, Math.min(length, rawOffset));
  if (Math.abs(rawOffset) <= tolerance) {
    position = 'start';
    offset = 0;
  } else if (Math.abs(rawOffset - length) <= tolerance) {
    position = 'end';
    offset = length;
  }

  return {
    wallId: resolvedWall.wallId,
    runAxis,
    position,
    offset: roundCoordinate(offset),
    rays: raysForPosition(runAxis, position)
  };
}

function classifyParticipants(participants) {
  const ownersByRay = new Map();
  for (const participant of participants) {
    for (const ray of participant.rays) {
      if (!ownersByRay.has(ray)) ownersByRay.set(ray, []);
      ownersByRay.get(ray).push(participant.wallId);
    }
  }

  if ([...ownersByRay.values()].some((owners) => owners.length > 1)) {
    return { type: 'ambiguous', rays: sortRays(ownersByRay.keys()), reason: 'overlapping-rays' };
  }

  const rays = sortRays(ownersByRay.keys());
  if (rays.length === 1) return { type: 'terminal', rays, reason: null };
  if (rays.length === 2) {
    if (rayAxis(rays[0]) !== rayAxis(rays[1])) return { type: 'L', rays, reason: null };
    const opposite = (
      (rays.includes('W') && rays.includes('E'))
      || (rays.includes('S') && rays.includes('N'))
    );
    return opposite
      ? { type: 'straight', rays, reason: null }
      : { type: 'ambiguous', rays, reason: 'invalid-rays' };
  }
  if (rays.length === 3) {
    const continuousX = rays.includes('W') && rays.includes('E');
    const continuousY = rays.includes('S') && rays.includes('N');
    return continuousX || continuousY
      ? { type: 'T', rays, reason: null }
      : { type: 'ambiguous', rays, reason: 'invalid-rays' };
  }
  if (rays.length === 4) return { type: 'X', rays, reason: null };
  return { type: 'ambiguous', rays, reason: 'invalid-rays' };
}

function participantSignature(participant) {
  return [
    stableIdToken(participant.wallId),
    participant.runAxis,
    participant.position,
    formatCoordinate(participant.offset),
    participant.rays.join(',')
  ].join('|');
}

function bandSignature(band) {
  return [
    band.type,
    band.reason || '',
    band.rays.join(','),
    ...band.participants.map(participantSignature)
  ].join('::');
}

function mergeAdjacentBands(bands) {
  const merged = [];
  for (const band of bands) {
    const previous = merged[merged.length - 1];
    if (
      previous
      && Math.abs(previous.zMax - band.zMin) <= GEOMETRY_EPS
      && bandSignature(previous) === bandSignature(band)
    ) {
      previous.zMax = band.zMax;
    } else {
      merged.push({
        ...band,
        participants: band.participants.map((participant) => ({
          ...participant,
          rays: [...participant.rays]
        }))
      });
    }
  }
  return merged;
}

function buildNodeId(point, band) {
  const participants = band.participants
    .map((participant) => encodeURIComponent(stableIdToken(participant.wallId)))
    .join(',');
  return [
    'junction',
    formatCoordinate(point.x),
    formatCoordinate(point.y),
    formatCoordinate(band.zMin),
    formatCoordinate(band.zMax),
    band.type,
    participants
  ].join(':');
}

/**
 * Compara candidatos de traslape. Resultado negativo significa que `a` tiene prioridad:
 * mayor largo, luego mayor |dx|, luego menor ID estable.
 */
export function compareLappingPriority(a, b) {
  return (
    Number(b.length) - Number(a.length)
    || Number(b.absDx) - Number(a.absDx)
    || compareStableWallIds(a.wallId, b.wallId)
  );
}

export function selectLappingWall(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return [...candidates].sort(compareLappingPriority)[0];
}

function nodeLap(node, resolvedById) {
  if (node.type !== 'L' || node.participants.length !== 2) return null;
  const candidates = node.participants.map((participant) => {
    const wall = resolvedById.get(stableIdToken(participant.wallId));
    return {
      wallId: participant.wallId,
      length: wall.length,
      absDx: wall.absDx
    };
  });
  const winner = selectLappingWall(candidates);
  const loser = candidates.find((candidate) => !sameId(candidate.wallId, winner.wallId));
  return { wallId: winner.wallId, buttWallId: loser.wallId };
}

function compareParticipants(a, b) {
  return compareStableWallIds(a.wallId, b.wallId);
}

function buildNodes(resolvedWalls, tolerance) {
  const resolvedById = new Map(
    resolvedWalls.map((wall) => [stableIdToken(wall.wallId), wall])
  );
  const coordinates = clusterEndpointCoordinates(resolvedWalls, tolerance);
  const nodes = [];

  for (const point of coordinates) {
    const located = resolvedWalls.map((wall) => ({
      wall,
      participant: participantAtPoint(wall, point, tolerance)
    })).filter((entry) => entry.participant);
    const bounds = [...new Set(located.flatMap(({ wall }) => [wall.zMin, wall.zMax]))]
      .sort((a, b) => a - b);
    const bands = [];

    for (let index = 0; index < bounds.length - 1; index++) {
      const zMin = bounds[index];
      const zMax = bounds[index + 1];
      if (!(zMax - zMin > GEOMETRY_EPS)) continue;
      const midpoint = (zMin + zMax) / 2;
      const participants = located
        .filter(({ wall }) => wall.zMin < midpoint && wall.zMax > midpoint)
        .map(({ participant }) => ({
          ...participant,
          rays: [...participant.rays]
        }))
        .sort(compareParticipants);
      if (participants.length === 0) continue;

      const classification = classifyParticipants(participants);
      bands.push({
        zMin,
        zMax,
        participants,
        ...classification
      });
    }

    for (const band of mergeAdjacentBands(bands)) {
      const node = {
        id: buildNodeId(point, band),
        point: { ...point },
        zMin: band.zMin,
        zMax: band.zMax,
        type: band.type,
        rays: [...band.rays],
        participants: band.participants.map((participant) => ({
          ...participant,
          rays: [...participant.rays]
        })),
        lap: null
      };
      if (band.reason) node.reason = band.reason;
      node.lap = nodeLap(node, resolvedById);
      nodes.push(node);
    }
  }

  nodes.sort((a, b) => (
    a.point.x - b.point.x
    || a.point.y - b.point.y
    || a.zMin - b.zMin
    || a.zMax - b.zMax
    || compareCodePoints(a.type, b.type)
    || compareCodePoints(a.id, b.id)
  ));
  return nodes;
}

function uniqueMatches(matches) {
  const byKey = new Map();
  for (const match of matches) {
    const key = `${stableIdToken(match.wallId)}|${match.tipo}|${match.nodeId}`;
    if (!byKey.has(key)) byKey.set(key, match);
  }
  return [...byKey.values()].sort((a, b) => (
    compareStableWallIds(a.wallId, b.wallId)
    || compareCodePoints(a.tipo, b.tipo)
    || compareCodePoints(a.nodeId, b.nodeId)
  ));
}

function collapseEndpointEvents(events) {
  if (events.length === 0) return null;
  const matches = uniqueMatches(events.flatMap((event) => event.matches));
  const types = [...new Set(events.map((event) => event.tipo))];
  const lapStates = [...new Set(events.map((event) => event.lapState).filter(Boolean))];
  return {
    tipo: types.length === 1 ? types[0] : 'ambiguous',
    wallId: matches[0]?.wallId ?? null,
    matches,
    lapState: lapStates.length <= 1 ? (lapStates[0] || null) : 'ambiguous'
  };
}

function buildWallViews(resolvedWalls, nodes) {
  const mutable = new Map(resolvedWalls.map((wall) => [
    stableIdToken(wall.wallId),
    {
      wallId: wall.wallId,
      startEvents: [],
      endEvents: [],
      interior: [],
      unsupported: []
    }
  ]));

  for (const node of nodes) {
    for (const participant of node.participants) {
      const view = mutable.get(stableIdToken(participant.wallId));
      if (!view) continue;

      if (node.type !== 'L' && node.type !== 'T') {
        view.unsupported.push({
          tipo: node.type,
          offset: participant.offset,
          position: participant.position,
          nodeId: node.id,
          wallIds: node.participants.map((entry) => entry.wallId)
        });
        continue;
      }

      const matches = node.participants
        .filter((other) => (
          !sameId(other.wallId, participant.wallId)
          && (node.type === 'L' || other.runAxis !== participant.runAxis)
        ))
        .map((other) => ({ wallId: other.wallId, tipo: node.type, nodeId: node.id }))
        .sort((a, b) => compareStableWallIds(a.wallId, b.wallId));
      const lapState = node.type === 'L'
        ? (sameId(node.lap.wallId, participant.wallId) ? 'lap' : 'butt')
        : null;

      if (participant.position === 'body') {
        for (const match of matches) {
          view.interior.push({
            tipo: node.type,
            wallId: match.wallId,
            offset: participant.offset,
            nodeId: node.id
          });
        }
      } else {
        view[`${participant.position}Events`].push({
          tipo: node.type,
          matches,
          lapState
        });
      }
    }
  }

  return [...mutable.values()].map((view) => ({
    wallId: view.wallId,
    start: collapseEndpointEvents(view.startEvents),
    end: collapseEndpointEvents(view.endEvents),
    interior: view.interior.sort((a, b) => (
      a.offset - b.offset
      || compareStableWallIds(a.wallId, b.wallId)
      || compareCodePoints(a.nodeId, b.nodeId)
    )),
    unsupported: view.unsupported.sort((a, b) => (
      a.offset - b.offset
      || compareCodePoints(a.tipo, b.tipo)
      || compareCodePoints(a.nodeId, b.nodeId)
    ))
  })).sort((a, b) => compareStableWallIds(a.wallId, b.wallId));
}

function buildIssues(nodes, wallViews) {
  const issues = nodes.filter((node) => node.type === 'ambiguous').map((node) => ({
    type: 'ambiguous-geometry',
    nodeId: node.id,
    wallIds: node.participants.map((participant) => participant.wallId),
    reason: node.reason
  }));

  for (const view of wallViews) {
    for (const side of ['start', 'end']) {
      const endpoint = view[side];
      if (endpoint?.lapState === 'ambiguous') {
        const wallIds = [
          view.wallId,
          ...endpoint.matches.map((match) => match.wallId)
        ].sort(compareStableWallIds);
        issues.push({
          type: 'ambiguous-lap',
          wallId: view.wallId,
          wallIds,
          side,
          nodeIds: endpoint.matches.map((match) => match.nodeId)
        });
      }
    }
  }
  return issues;
}

/**
 * Analiza todos los muros del modelo en una sola operación.
 *
 * @returns {{
 *   tolerance: number,
 *   nodes: Array,
 *   wallViews: Array,
 *   unresolved: Array,
 *   issues: Array
 * }}
 */
export function analyzeWallJunctions(model, options = {}) {
  const rawTolerance = Number(options.tolerance ?? WALL_JUNCTION_TOLERANCE);
  const tolerance = Number.isFinite(rawTolerance) && rawTolerance >= 0
    ? rawTolerance
    : WALL_JUNCTION_TOLERANCE;
  const { resolved, unresolved } = resolveWalls(model, tolerance, options);
  const nodes = buildNodes(resolved, tolerance);
  const wallViews = buildWallViews(resolved, nodes);

  return {
    tolerance,
    nodes,
    wallViews,
    unresolved,
    issues: buildIssues(nodes, wallViews)
  };
}

export function getWallJunctionView(topology, wallId) {
  return topology?.wallViews?.find((view) => sameId(view.wallId, wallId)) || null;
}
