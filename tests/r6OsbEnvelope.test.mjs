import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeWallJunctions, getWallJunctionView } from '../src/core/wallJunctions.js';
import { computeStudLayout } from '../src/core/metalconModulation.js';
import {
  computeOsbPanelLayout,
  resolveWallOsbEnvelope
} from '../src/core/osbModulation.js';
import {
  modulateAllWallsOsb,
  modulateAllWallsFull
} from '../src/core/batchModulation.js';
import { drawOsbLayoutElevation } from '../src/render/osbModulation.js';
import { generateOsbFramingDxf } from '../src/core/exportOsbDxf.js';
import { generateOsbFramingSheets } from '../src/core/exportSheetsDxf.js';
import { computeTakeoff } from '../src/core/takeoff.js';

const grid = {
  xAxes: [
    { id: 'X0', position: 0 },
    { id: 'X2', position: 2000 },
    { id: 'X4', position: 4000 }
  ],
  yAxes: [
    { id: 'Y0', position: 0 },
    { id: 'Y2', position: 2000 },
    { id: 'Y4', position: 4000 }
  ],
  zLevels: [
    { id: 'Z0', elevation: 0 },
    { id: 'Z1', elevation: 2400 },
    { id: 'Z2', elevation: 4800 }
  ]
};

function wall(id, direction, start, end, overrides = {}) {
  const axisId = (axis, value) => `${axis.toUpperCase()}${value / 1000}`;
  return {
    id,
    type: 'wall',
    direction,
    xStart: axisId('x', start[0]),
    xEnd: axisId('x', end[0]),
    yStart: axisId('y', start[1]),
    yEnd: axisId('y', end[1]),
    bottomZ: 'Z0',
    topZ: 'Z1',
    thickness: 90,
    openings: [],
    ...overrides
  };
}

function studs(length, wallHeight = 2400) {
  const offsets = [];
  for (let offset = 0; offset < length; offset += 400) offsets.push(offset);
  offsets.push(length);
  return [...new Set(offsets)].map((offset) => ({
    offset,
    zMin: 0,
    zMax: wallHeight,
    role: offset === 0 || offset === length ? 'corner' : 'stud'
  }));
}

function model(elements) {
  return {
    grid,
    projectParams: [],
    elements,
    library: {
      metalconProfiles: [
        { id: 'C90', shape: 'C', B: 40 },
        { id: 'U90', shape: 'U' }
      ]
    },
    metalconDefaults: {
      spacing: 400,
      studProfileId: 'C90',
      trackProfileId: 'U90'
    },
    osbDefaults: {
      panelWidth: 1220,
      panelHeight: 2440,
      minPanelWidth: 200,
      gap: 5
    }
  };
}

function panelBounds(layout) {
  const panels = layout.courses.flatMap((course) => course.panels);
  return {
    start: Math.min(...panels.map((panel) => panel.start)),
    end: Math.max(...panels.map((panel) => panel.end))
  };
}

test('R6-C: una L aplica insets firmados de media cara sin cambiar el largo nominal', () => {
  const lapping = wall('lap', 'x', [0, 0], [4000, 0], {
    thickness: 100,
    studs: studs(4000)
  });
  const butt = wall('butt', 'y', [0, 0], [0, 2000], {
    thickness: 80,
    studs: studs(2000)
  });
  const source = model([butt, lapping]);
  const topology = analyzeWallJunctions(source);
  const elementsById = Object.fromEntries(source.elements.map((element) => [element.id, element]));

  const lapEnvelope = resolveWallOsbEnvelope(
    lapping,
    4000,
    getWallJunctionView(topology, lapping.id),
    {},
    elementsById
  );
  const buttEnvelope = resolveWallOsbEnvelope(
    butt,
    2000,
    getWallJunctionView(topology, butt.id),
    {},
    elementsById
  );
  assert.deepEqual(lapEnvelope, {
    resolved: true,
    startInset: -40,
    endInset: 0,
    osbStart: -40,
    osbEnd: 4000,
    osbLength: 4040,
    errors: []
  });
  assert.deepEqual(buttEnvelope, {
    resolved: true,
    startInset: 50,
    endInset: 0,
    osbStart: 50,
    osbEnd: 2000,
    osbLength: 1950,
    errors: []
  });

  const lapLayout = computeOsbPanelLayout(
    lapping,
    grid,
    {},
    elementsById,
    lapping.studs,
    { ...source.osbDefaults, junctions: getWallJunctionView(topology, lapping.id) }
  );
  const buttLayout = computeOsbPanelLayout(
    butt,
    grid,
    {},
    elementsById,
    butt.studs,
    { ...source.osbDefaults, junctions: getWallJunctionView(topology, butt.id) }
  );
  assert.equal(lapLayout.length, 4000);
  assert.equal(buttLayout.length, 2000);
  assert.deepEqual(panelBounds(lapLayout), { start: -40, end: 4000 });
  assert.deepEqual(panelBounds(buttLayout), { start: 50, end: 2000 });
});

test('R6-C: dos extremos L se extienden de forma independiente y T conserva deepEqual', () => {
  const center = wall('center', 'x', [0, 0], [4000, 0], {
    thickness: 90,
    studs: studs(4000)
  });
  const left = wall('left', 'y', [0, 0], [0, 2000], { thickness: 70 });
  const right = wall('right', 'y', [4000, 0], [4000, 2000], { thickness: 110 });
  const source = model([right, center, left]);
  const topology = analyzeWallJunctions(source);
  const elementsById = Object.fromEntries(source.elements.map((element) => [element.id, element]));
  const layout = computeOsbPanelLayout(
    center,
    grid,
    {},
    elementsById,
    center.studs,
    { ...source.osbDefaults, junctions: getWallJunctionView(topology, center.id) }
  );
  assert.deepEqual(panelBounds(layout), { start: -35, end: 4055 });

  const host = wall('host', 'x', [0, 0], [4000, 0], { studs: studs(4000) });
  const branch = wall('branch', 'y', [2000, 0], [2000, 2000]);
  const tSource = model([branch, host]);
  const tTopology = analyzeWallJunctions(tSource);
  const tElements = Object.fromEntries(tSource.elements.map((element) => [element.id, element]));
  const nominal = computeOsbPanelLayout(
    host,
    grid,
    {},
    tElements,
    host.studs,
    tSource.osbDefaults
  );
  const coordinated = computeOsbPanelLayout(
    host,
    grid,
    {},
    tElements,
    host.studs,
    { ...tSource.osbDefaults, junctions: getWallJunctionView(tTopology, host.id) }
  );
  assert.deepEqual(coordinated, nominal);
});

test('R6-C: vano, margen mínimo y corredor usan el borde OSB efectivo', () => {
  const lapping = wall('lap', 'x', [0, 0], [4000, 0], { thickness: 100 });
  const butt = wall('butt', 'y', [0, 0], [0, 2000], {
    thickness: 80,
    openings: [{
      id: 'window',
      axisType: 'y',
      type: 'window',
      position: 550,
      width: 800,
      height: 1000,
      sillHeight: 900
    }]
  });
  const studLayout = computeStudLayout(butt, grid, {}, {}, { spacing: 400 });
  butt.studs = studLayout.studs;
  const source = model([lapping, butt]);
  const topology = analyzeWallJunctions(source);
  const elementsById = Object.fromEntries(source.elements.map((element) => [element.id, element]));
  const layout = computeOsbPanelLayout(
    butt,
    grid,
    {},
    elementsById,
    butt.studs,
    { ...source.osbDefaults, junctions: getWallJunctionView(topology, butt.id) }
  );

  assert.equal(layout.osbStart, 50);
  assert.equal(panelBounds(layout).start, 50);
  const cutout = layout.courses.flatMap((course) => course.panels)
    .flatMap((panel) => panel.cutouts || [])[0];
  assert.deepEqual(
    { start: cutout.start, end: cutout.end },
    { start: 150, end: 950 }
  );
});

test('R6-C: prioridad L o espesor irresoluble bloquean OSB y combinado sin patches parciales', () => {
  const shared = wall('shared', 'x', [0, 0], [2000, 0], {
    topZ: 'Z2',
    studs: studs(2000, 4800)
  });
  const lower = wall('lower', 'y', [0, 0], [0, 2000], {
    studs: studs(2000)
  });
  const upper = wall('upper', 'y', [0, 0], [0, 4000], {
    bottomZ: 'Z1',
    topZ: 'Z2',
    studs: studs(4000)
  });
  const ambiguous = model([upper, shared, lower]);
  const osbAmbiguous = modulateAllWallsOsb(ambiguous);
  assert.equal(osbAmbiguous.patches.length, 0);
  assert.equal(osbAmbiguous.blocked[0].reason, 'ambiguous-lap');
  assert.deepEqual(osbAmbiguous.blocked[0].wallIds, ['lower', 'shared', 'upper']);

  const lap = wall('lap', 'x', [0, 0], [4000, 0], {
    thickness: 90,
    studs: studs(4000)
  });
  const invalid = wall('invalid', 'y', [0, 0], [0, 2000], {
    thickness: '=missing',
    studs: studs(2000)
  });
  const unresolved = model([lap, invalid]);
  const osb = modulateAllWallsOsb(unresolved);
  const full = modulateAllWallsFull(unresolved);
  assert.equal(osb.patches.length, 0);
  assert.equal(full.patches.length, 0);
  assert.equal(osb.blocked[0].reason, 'unresolved-l-wall-thickness');
  assert.deepEqual(osb.blocked[0].wallIds, ['invalid', 'lap']);
});

test('R6-C: casa-L rebasa exactamente su envolvente y metrado OSB', async () => {
  const source = JSON.parse(await readFile(
    new URL('./fixtures/casa-L.json', import.meta.url),
    'utf8'
  ));
  const result = modulateAllWallsFull(source, {
    metalcon: source.metalconDefaults || {},
    osb: source.osbDefaults || {}
  });
  assert.equal(result.blocked.length, 0);
  assert.equal(result.patches.length, 45);

  const patches = new Map(
    result.patches.map(({ wallId, patch }) => [String(wallId), patch])
  );
  const regenerated = {
    ...source,
    elements: source.elements.map((element) => (
      patches.has(String(element.id))
        ? { ...element, ...patches.get(String(element.id)) }
        : element
    ))
  };
  const walls = regenerated.elements.filter((element) => element.type === 'wall');
  const wallStats = walls.map((candidate) => {
    const panels = (candidate.osbCourses || []).flatMap((course) => course.panels);
    const nominalLength = Math.max(
      ...(candidate.studs || [])
        .filter((piece) => Number.isFinite(piece.offset))
        .map((piece) => piece.offset)
    );
    return {
      panels,
      nominalLength,
      start: Math.min(...panels.map((panel) => panel.start)),
      end: Math.max(...panels.map((panel) => panel.end))
    };
  });
  const panels = wallStats.flatMap((stats) => stats.panels);
  const takeoff = computeTakeoff(regenerated);

  assert.equal(panels.length, 408);
  assert.ok(
    Math.abs(panels.reduce((total, panel) => total + panel.width, 0) - 383263.2) < 0.01
  );
  assert.equal(
    wallStats.filter((stats) => (
      stats.start < -0.01 || stats.end > stats.nominalLength + 0.01
    )).length,
    16
  );
  assert.equal(
    wallStats.filter((stats) => (
      stats.start > 0.01 || stats.end < stats.nominalLength - 0.01
    )).length,
    18
  );
  assert.equal(Math.min(...wallStats.map((stats) => stats.start)), -50.5);
  assert.ok(
    Math.abs(
      Math.max(...wallStats.map((stats) => stats.end - stats.nominalLength))
      - 50.6
    ) < 0.01
  );
  assert.deepEqual(takeoff.totalsByType.osb, {
    typeLabel: 'OSB',
    count: 284,
    ml: 0,
    m2: 845.4112,
    m3: 0,
    warnings: 0
  });
  assert.deepEqual(takeoff.totalsByType.framing, {
    typeLabel: 'Tabiquería',
    count: 1361,
    ml: 2500.1469999999986,
    m2: 0,
    m3: 0,
    warnings: 0
  });
});

function polylineWidths(dxf) {
  return dxf.split('0\nPOLYLINE\n').slice(1).map((block) => {
    const beforeEnd = block.split('0\nSEQEND\n')[0];
    const xs = [...beforeEnd.matchAll(/(?:^|\n)10\n(-?[\d.]+)/g)]
      .map((match) => Number(match[1]));
    return xs.length > 0 ? Math.max(...xs) - Math.min(...xs) : 0;
  });
}

function lineWidths(dxf) {
  const tokens = dxf.split('\n').map((token) => token.trim());
  const widths = [];
  for (let index = 0; index < tokens.length - 1; index++) {
    if (tokens[index] !== '0' || tokens[index + 1] !== 'LINE') continue;
    let x1 = null;
    let x2 = null;
    for (let cursor = index + 2; cursor < tokens.length - 1; cursor += 2) {
      if (tokens[cursor] === '0') break;
      if (tokens[cursor] === '10') x1 = Number(tokens[cursor + 1]);
      if (tokens[cursor] === '11') x2 = Number(tokens[cursor + 1]);
    }
    if (Number.isFinite(x1) && Number.isFinite(x2)) widths.push(Math.abs(x2 - x1));
  }
  return widths;
}

test('R6-C: preview, R12 y AC1015 representan offsets fuera del largo nominal', () => {
  const extended = wall('extended', 'x', [0, 0], [4000, 0], {
    studs: studs(4000),
    headers: [],
    osbCourses: [{
      zMin: 0,
      zMax: 2400,
      height: 2400,
      panels: [
        { start: -45, end: 1175, width: 1220 },
        { start: 1175, end: 2395, width: 1220 },
        { start: 2395, end: 3615, width: 1220 },
        { start: 3615, end: 4045, width: 430 }
      ]
    }]
  });
  const source = model([extended]);
  const fills = [];
  const context = {
    clearRect() {},
    fillText() {},
    fillRect(...args) { fills.push(args); },
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    setLineDash() {}
  };
  drawOsbLayoutElevation(
    context,
    {
      courses: extended.osbCourses,
      length: 4000,
      osbStart: -45,
      osbEnd: 4045,
      wallHeight: 2400,
      studs: extended.studs
    },
    500,
    300,
    { gap: 0 }
  );
  const panelFills = fills.slice(0, 4);
  const previewScale = Math.min((500 - 56) / 4090, (300 - 56) / 2400);
  assert.ok(Math.abs(panelFills[0][0] - 28) < 0.01);
  assert.ok(
    Math.abs(
      panelFills.at(-1)[0] + panelFills.at(-1)[2]
      - (28 + 4090 * previewScale)
    ) < 0.01
  );

  const r12 = generateOsbFramingDxf(source);
  const sheets = generateOsbFramingSheets(source);
  assert.ok(polylineWidths(r12).some((width) => Math.abs(width - 4090) < 0.01));
  assert.ok(
    sheets.some((sheet) => lineWidths(sheet.content)
      .some((width) => Math.abs(width - 4090) < 0.01))
  );
});
