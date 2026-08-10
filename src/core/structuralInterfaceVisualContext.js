import { wallFrame } from './structuralProposalCommon.js';

const EPS = 1e-6;

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizedRange(value, fallback) {
  if (!Array.isArray(value) || value.length !== 2) return [...fallback];
  const a = finite(value[0]);
  const b = finite(value[1]);
  if (a === null || b === null) return [...fallback];
  return [Math.min(a, b), Math.max(a, b)];
}

function pointAt(frame, s, n = 0) {
  return frame.axis === 'x'
    ? { x: s, y: frame.fixed + n }
    : { x: frame.fixed - n, y: s };
}

function boundsFromPoints(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  return {
    xMin: Math.min(...points.map((point) => point.x)),
    xMax: Math.max(...points.map((point) => point.x)),
    yMin: Math.min(...points.map((point) => point.y)),
    yMax: Math.max(...points.map((point) => point.y))
  };
}

function unionBounds(...items) {
  const bounds = items.filter(Boolean);
  if (bounds.length === 0) return null;
  return {
    xMin: Math.min(...bounds.map((item) => item.xMin)),
    xMax: Math.max(...bounds.map((item) => item.xMax)),
    yMin: Math.min(...bounds.map((item) => item.yMin)),
    yMax: Math.max(...bounds.map((item) => item.yMax))
  };
}

function label(value, fallback) {
  return value == null || value === '' ? fallback : String(value);
}

function frameLabels(visualTarget, frame) {
  const axis = visualTarget?.descriptor?.axis;
  const lowSLabel = label(axis?.fromLabel, `${frame.s0}`);
  const highSLabel = label(axis?.toLabel, `${frame.s1}`);
  const fixedLabel = label(axis?.fixedLabel, `${frame.fixed}`);
  return {
    lowSLabel,
    highSLabel,
    fixedLabel,
    runAxis: frame.axis.toUpperCase(),
    hostPhrase: axis?.nominal || `${frame.axis.toUpperCase()} ${lowSLabel}→${highSLabel} @ ${fixedLabel}`
  };
}

function hostPolygon(frame, thickness) {
  const half = thickness / 2;
  return [
    pointAt(frame, frame.s0, -half),
    pointAt(frame, frame.s1, -half),
    pointAt(frame, frame.s1, half),
    pointAt(frame, frame.s0, half)
  ];
}

function faceGeometry(frame, thickness, side, sRange) {
  const sign = side === 'negativeN' ? -1 : 1;
  const half = thickness / 2;
  const faceN = sign * half;
  const depth = Math.max(25, Math.min(80, thickness * 0.35));
  const [s0, s1] = sRange;
  const faceSegment = [pointAt(frame, s0, faceN), pointAt(frame, s1, faceN)];
  const polygon = [
    pointAt(frame, s0, faceN),
    pointAt(frame, s1, faceN),
    pointAt(frame, s1, faceN + sign * depth),
    pointAt(frame, s0, faceN + sign * depth)
  ];
  return {
    label: side === 'positiveN' ? 'Cara +N' : 'Cara −N',
    mark: side === 'positiveN' ? '+N' : '−N',
    polygon,
    faceSegment,
    selectedGuide: side === 'positiveN' ? 'positiveN' : 'negativeN'
  };
}

function endGeometry(frame, thickness, end) {
  const isLow = end === 'lowS';
  const half = thickness / 2;
  const depth = Math.max(25, Math.min(80, thickness * 0.35));
  const s = isLow ? frame.s0 : frame.s1;
  const outside = isLow ? s - depth : s + depth;
  const faceSegment = [pointAt(frame, s, -half), pointAt(frame, s, half)];
  const polygon = [
    pointAt(frame, s, -half),
    pointAt(frame, s, half),
    pointAt(frame, outside, half),
    pointAt(frame, outside, -half)
  ];
  return {
    label: isLow ? 'Extremo S mínimo' : 'Extremo S máximo',
    mark: isLow ? 'S−' : 'S+',
    polygon,
    faceSegment,
    selectedGuide: isLow ? 'lowS' : 'highS'
  };
}

function regionGeometry(frame, thickness, sRange) {
  const half = thickness / 2;
  const [s0, s1] = sRange;
  const polygon = [
    pointAt(frame, s0, -half),
    pointAt(frame, s1, -half),
    pointAt(frame, s1, half),
    pointAt(frame, s0, half)
  ];
  return {
    label: 'Región S/Z',
    mark: 'R',
    polygon,
    faceSegment: null,
    selectedGuide: 'region'
  };
}

function guideArrows(frame, thickness) {
  const half = thickness / 2;
  const arrowLength = Math.max(180, Math.min(600, frame.length * 0.14));
  const midS = (frame.s0 + frame.s1) / 2;
  return [
    {
      key: 'positiveN',
      label: '+N',
      from: pointAt(frame, midS, 0),
      to: pointAt(frame, midS, half + arrowLength)
    },
    {
      key: 'negativeN',
      label: '−N',
      from: pointAt(frame, midS, 0),
      to: pointAt(frame, midS, -(half + arrowLength))
    }
  ];
}

function expandedBounds(bounds, amount) {
  if (!bounds) return null;
  return {
    xMin: bounds.xMin - amount,
    xMax: bounds.xMax + amount,
    yMin: bounds.yMin - amount,
    yMax: bounds.yMax + amount
  };
}

export function buildStructuralInterfaceWallContext({
  wall,
  visualTarget = null,
  locatorKind = 'face',
  faceSide = 'positiveN',
  end = 'lowS',
  sRange = null,
  zRange = null
} = {}) {
  const frame = wallFrame(wall);
  const thickness = finite(wall?.prism?.thickness);
  if (!frame || thickness === null || !(thickness > 0)) return null;

  const rawSRange = normalizedRange(sRange, [frame.s0, frame.s1]);
  const clampedSRange = [
    clamp(rawSRange[0], frame.s0, frame.s1),
    clamp(rawSRange[1], frame.s0, frame.s1)
  ];
  if (clampedSRange[1] - clampedSRange[0] <= EPS) {
    clampedSRange[0] = frame.s0;
    clampedSRange[1] = frame.s1;
  }
  const normalizedZRange = normalizedRange(zRange, [frame.z0, frame.z1]);
  const labels = frameLabels(visualTarget, frame);
  const host = hostPolygon(frame, thickness);
  const arrows = guideArrows(frame, thickness);

  let selected;
  if (locatorKind === 'end') selected = endGeometry(frame, thickness, end);
  else if (locatorKind === 'region') selected = regionGeometry(frame, thickness, clampedSRange);
  else selected = faceGeometry(frame, thickness, faceSide, clampedSRange);

  const normalWorld = frame.axis === 'x'
    ? { positiveN: '+Y', negativeN: '−Y' }
    : { positiveN: '−X', negativeN: '+X' };
  const hostBounds = boundsFromPoints(host);
  const selectedBounds = boundsFromPoints(selected.polygon);
  const arrowBounds = boundsFromPoints(arrows.flatMap((arrow) => [arrow.from, arrow.to]));
  const displayBounds = expandedBounds(unionBounds(hostBounds, selectedBounds, arrowBounds), Math.max(30, thickness * 0.2));
  const locatorBounds = expandedBounds(unionBounds(hostBounds, selectedBounds), Math.max(30, thickness * 0.2));

  const contextTarget = {
    id: wall.id,
    targetType: 'element',
    descriptor: visualTarget?.descriptor || null,
    planGeometry: { kind: 'interface-host', polygon: host },
    openings: [],
    bounds: hostBounds,
    mark: null
  };
  const selectedTarget = {
    id: wall.id,
    targetType: 'element',
    descriptor: {
      ...(visualTarget?.descriptor || {}),
      summary: `${visualTarget?.descriptor?.summary || `Muro ${String(wall.id)}`} · ${selected.label}`
    },
    planGeometry: { kind: 'interface-location', polygon: selected.polygon },
    openings: [],
    bounds: selectedBounds,
    mark: selected.mark,
    interfaceLocation: {
      kind: locatorKind,
      side: locatorKind === 'face' ? faceSide : null,
      end: locatorKind === 'end' ? end : null,
      sRange: clampedSRange,
      zRange: normalizedZRange,
      faceSegment: selected.faceSegment
    }
  };

  return {
    canUse: true,
    wallId: wall.id,
    axis: frame.axis,
    frame,
    thickness,
    labels,
    normalWorld,
    hostPolygon: host,
    centerline: [pointAt(frame, frame.s0, 0), pointAt(frame, frame.s1, 0)],
    arrows,
    selected,
    sRange: clampedSRange,
    zRange: normalizedZRange,
    displayBounds,
    locatorPreview: {
      canUse: true,
      selected: [selectedTarget],
      context: [contextTarget],
      activeId: wall.id,
      targetBounds: selectedBounds,
      visibleBounds: locatorBounds
    }
  };
}
