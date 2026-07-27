import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modulateAllWallsFull } from '../src/core/batchModulation.js';
import { computeStudLayout } from '../src/core/metalconModulation.js';
import { computeCourseBreaks, computeOsbPanelLayout } from '../src/core/osbModulation.js';
import { buildParamsMap } from '../src/core/projectParams.js';
import { buildElementsById } from '../src/core/elementReferences.js';
import { studFlangeSpan } from '../src/core/trussLayout.js';
import { generateCalculix } from '../src/core/exportCalculix.js';
import { computeTakeoff } from '../src/core/takeoff.js';
import { getWallJunctionView } from '../src/core/wallJunctions.js';

const casaL = JSON.parse(
  readFileSync(new URL('./fixtures/casa-L.json', import.meta.url), 'utf8')
);

function wallConfig(wall, model = casaL) {
  return {
    panelWidth: wall.osbPanelWidth ?? model.osbDefaults?.panelWidth ?? 1220,
    panelHeight: wall.osbPanelHeight ?? model.osbDefaults?.panelHeight ?? 2440,
    minPanelWidth: wall.osbMinPanelWidth ?? model.osbDefaults?.minPanelWidth ?? 200
  };
}

function profileWidth(model, wall) {
  return model.library.metalconProfiles
    .find((profile) => profile.id === wall.framingStudProfileId)?.B;
}

function uniqueVerticalStuds(studs) {
  const byOffset = new Map();
  for (const stud of studs.filter((piece) => piece.role !== 'nogging')) {
    if (!byOffset.has(stud.offset)) byOffset.set(stud.offset, stud);
  }
  return [...byOffset.values()].sort((a, b) => a.offset - b.offset);
}

function regenerateCasaL() {
  const result = modulateAllWallsFull(casaL, {
    metalcon: casaL.metalconDefaults || {},
    osb: casaL.osbDefaults || {}
  });
  const patches = new Map(
    result.patches.map(({ wallId, patch }) => [String(wallId), patch])
  );
  return {
    ...casaL,
    elements: casaL.elements.map((element) => (
      patches.has(String(element.id))
        ? { ...element, ...patches.get(String(element.id)) }
        : element
    ))
  };
}

function countInpCards(inp) {
  let section = '';
  let nodes = 0;
  let elements = 0;
  for (const rawLine of inp.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('*')) {
      section = /^\*NODE\b/i.test(line)
        ? 'node'
        : /^\*ELEMENT\b/i.test(line) ? 'element' : '';
    } else if (/^\d+\s*,/.test(line)) {
      if (section === 'node') nodes += 1;
      if (section === 'element') elements += 1;
    }
  }
  return { nodes, elements };
}

test('R6-B: casa-L rebasa cadenetas reales con los pilares L/T y limpia el subproducto OSB', () => {
  const oldWalls = casaL.elements.filter((element) => element.type === 'wall');
  assert.equal(oldWalls.filter((wall) => wall.osbNoggings?.length > 0).length, 40);
  assert.equal(oldWalls.reduce((sum, wall) => sum + (wall.osbNoggings?.length || 0), 0), 67);

  const result = modulateAllWallsFull(casaL, {
    metalcon: casaL.metalconDefaults || {},
    osb: casaL.osbDefaults || {}
  });
  const patches = new Map(result.patches.map(({ wallId, patch }) => [wallId, patch]));
  const wallsWithNoggings = oldWalls.filter((wall) =>
    patches.get(wall.id)?.studs?.some((piece) => piece.role === 'nogging')
  );
  const noggings = wallsWithNoggings.flatMap((wall) =>
    patches.get(wall.id).studs.filter((piece) => piece.role === 'nogging')
  );

  assert.equal(wallsWithNoggings.length, 40);
  assert.ok(
    wallsWithNoggings.every((wall) => patches.get(wall.id).osbNoggings.length === 0),
    'wall.osbNoggings deja de almacenar las cadenetas'
  );
  assert.equal(noggings.length, 439, 'los 67 tramos continuos se reparten entre los nuevos apoyos L/T');
  assert.equal(
    noggings.reduce((sum, piece) => sum + piece.oMax - piece.oMin, 0),
    136447,
    'largo neto exacto, descontando las caras reales de los montantes'
  );
});

test('R3-A: cada pieza de casa-L va de cara a cara entre montantes consecutivos, sin solaparlos', () => {
  const result = modulateAllWallsFull(casaL, {
    metalcon: casaL.metalconDefaults || {},
    osb: casaL.osbDefaults || {}
  });
  const wallById = new Map(casaL.elements.map((element) => [element.id, element]));
  let checked = 0;

  for (const { wallId, patch } of result.patches) {
    const wall = wallById.get(wallId);
    const flangeWidth = profileWidth(casaL, wall);
    const vertical = uniqueVerticalStuds(patch.studs || []);
    const ctx = {
      length: Math.max(...vertical.map((stud) => stud.offset)),
      jambMins: (patch.headers || []).map((header) => header.oMin),
      jambMaxs: (patch.headers || []).map((header) => header.oMax)
    };
    const spans = vertical.map((stud) => ({
      stud,
      ...studFlangeSpan(stud, ctx, flangeWidth)
    }));

    for (const piece of (patch.studs || []).filter((item) => item.role === 'nogging')) {
      const pair = spans.find((left, index) => {
        const right = spans[index + 1];
        return right
          && Math.abs(piece.oMin - left.xMax) < 0.01
          && Math.abs(piece.oMax - right.xMin) < 0.01;
      });
      assert.ok(pair, `cadeneta ${wallId} [${piece.oMin}, ${piece.oMax}] sin par de caras`);
      checked += 1;
    }
  }

  assert.ok(checked > 67);
});

test('R3-A/D-021: las cadenetas no alteran una sola placa del baseline de casa-L', () => {
  const result = modulateAllWallsFull(casaL, {
    metalcon: casaL.metalconDefaults || {},
    osb: casaL.osbDefaults || {}
  });
  const paramsMap = buildParamsMap(casaL.projectParams || []);
  const elementsById = buildElementsById(casaL.elements || []);
  const wallById = new Map(casaL.elements.map((element) => [element.id, element]));

  for (const { wallId, patch } of result.patches) {
    const wall = wallById.get(wallId);
    const config = {
      ...wallConfig(wall),
      junctions: getWallJunctionView(result.topology, wallId)
    };
    const verticalStuds = patch.studs.filter((piece) => piece.role !== 'nogging');
    const baseline = computeOsbPanelLayout(
      wall, casaL.grid, paramsMap, elementsById, verticalStuds, config
    );
    const withNoggings = computeOsbPanelLayout(
      wall, casaL.grid, paramsMap, elementsById, patch.studs, config
    );
    assert.deepEqual(withNoggings.courses, baseline.courses, `placas cambiaron en muro ${wallId}`);
    assert.deepEqual(patch.osbCourses, baseline.courses, `batch cambió placas en muro ${wallId}`);
  }
});

test('R3-A/D-021: computeOsbPanelLayout ignora explícitamente cualquier role nogging', () => {
  const grid = {
    xAxes: [{ id: 'x0', position: 0 }, { id: 'x1', position: 3000 }],
    yAxes: [{ id: 'y0', position: 0 }],
    zLevels: [{ id: 'z0', elevation: 0 }, { id: 'z1', elevation: 3000 }]
  };
  const wall = {
    id: 'w1',
    type: 'wall',
    direction: 'x',
    xStart: 'x0',
    xEnd: 'x1',
    yStart: 'y0',
    yEnd: 'y0',
    bottomZ: 'z0',
    topZ: 'z1',
    openings: []
  };
  const vertical = [0, 1000, 2000, 3000].map((offset) => ({
    offset,
    zMin: 0,
    zMax: 3000,
    role: 'stud'
  }));
  const selfSupportingNogging = {
    offset: 1220,
    oMin: 1019,
    oMax: 1981,
    zMin: 0,
    zMax: 3000,
    role: 'nogging'
  };
  const config = { panelWidth: 1220, panelHeight: 2440, minPanelWidth: 200 };

  const baseline = computeOsbPanelLayout(wall, grid, {}, {}, vertical, config);
  const guarded = computeOsbPanelLayout(
    wall, grid, {}, {}, [...vertical, selfSupportingNogging], config
  );
  assert.deepEqual(guarded.courses, baseline.courses);
});

test('R6-B: casa-L rebasa CalculiX y las cadenetas siguen excluidas del INP', () => {
  const withNoggings = regenerateCasaL();
  const beforeR3 = {
    ...withNoggings,
    elements: withNoggings.elements.map((element) => (
      element.type === 'wall'
        ? {
            ...element,
            studs: (element.studs || []).filter((piece) => piece.role !== 'nogging')
          }
        : element
    ))
  };
  const baselineInp = generateCalculix(beforeR3);
  const currentInp = generateCalculix(withNoggings);

  assert.deepEqual(countInpCards(baselineInp), { nodes: 1384, elements: 1046 });
  assert.deepEqual(countInpCards(currentInp), countInpCards(baselineInp));
  assert.doesNotMatch(currentInp, /\b(?:NaN|Infinity)\b/);
});

test('R3-C: el kerf inicial del nesting es 5 mm y no lee osbDefaults.gap', () => {
  const source = readFileSync(
    new URL('../src/components/modals/OsbNestingModal.jsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /const \[kerf, setKerf\] = useState\(5\);/);
  assert.doesNotMatch(source, /osbDefaults\?\.gap/);
});

test('R6-B: el metrado rebasa 1361 piezas por perfil y rol sin alterar las 11 filas no framing', () => {
  const regenerated = regenerateCasaL();
  const withoutFraming = {
    ...regenerated,
    elements: regenerated.elements.map((element) => (
      element.type === 'wall' ? { ...element, studs: [], headers: [] } : element
    ))
  };
  const baselineRows = computeTakeoff(withoutFraming).rows;
  const takeoff = computeTakeoff(regenerated);
  const framingRows = takeoff.rows.filter((row) => row.type === 'framing');

  assert.equal(baselineRows.length, 11);
  assert.deepEqual(
    takeoff.rows.filter((row) => row.type !== 'framing'),
    baselineRows,
    'la sección aditiva no cambia ninguna fila heredada'
  );

  const expected = new Map([
    ['90CA085p — Pilar conformado esquina/T', { count: 109, ml: 366.3 }],
    ['90CA085p — Montante bajo antepecho', { count: 66, ml: 44.85 }],
    ['90CA085p — Montante sobre dintel', { count: 189, ml: 224.15 }],
    ['90CA085p — Montante extremo', { count: 7, ml: 18.1 }],
    ['90CA085p — Montante bajo dintel', { count: 86, ml: 210.7 }],
    ['90CA085p — Montante jamba', { count: 73, ml: 261.4 }],
    ['90CA085p — Cadeneta', { count: 439, ml: 136.447 }],
    ['90CA085p — Montante relleno', { count: 338, ml: 1155.4 }],
    ['92C085 — Dintel', { count: 43, ml: 61.9 }],
    ['92C085 — Antepecho', { count: 11, ml: 20.9 }]
  ]);

  assert.equal(framingRows.length, expected.size);
  for (const row of framingRows) {
    const target = expected.get(row.section);
    assert.ok(target, `fila inesperada: ${row.section}`);
    assert.equal(row.count, target.count, row.section);
    assert.ok(Math.abs(row.ml - target.ml) < 1e-9, row.section);
    assert.equal(row.warnings, 0, row.section);
  }
  assert.equal(takeoff.totalsByType.framing.count, 1361);
  assert.ok(Math.abs(takeoff.totalsByType.framing.ml - 2500.147) < 1e-9);
});

test('R3-A: una puerta que cruza la junta conserva dos corridas y ninguna pieza atraviesa el vano', () => {
  const grid = {
    xAxes: [{ id: 'x0', position: 0 }, { id: 'x1', position: 5000 }],
    yAxes: [{ id: 'y0', position: 0 }],
    zLevels: [{ id: 'z0', elevation: 0 }, { id: 'z1', elevation: 3000 }]
  };
  const wall = {
    id: 'w1',
    type: 'wall',
    direction: 'x',
    xStart: 'x0',
    xEnd: 'x1',
    yStart: 'y0',
    yEnd: 'y0',
    bottomZ: 'z0',
    topZ: 'z1',
    openings: [{
      id: 'door',
      axisType: 'x',
      type: 'door',
      position: 2500,
      width: 900,
      height: 2600
    }]
  };
  const courseBreaks = computeCourseBreaks(3000, 2440);
  assert.deepEqual(courseBreaks.jointZs, [2440]);

  const layout = computeStudLayout(wall, grid, {}, {}, {
    spacing: 400,
    jointZs: courseBreaks.jointZs,
    flangeWidth: 38
  });
  const noggings = layout.studs.filter((piece) => piece.role === 'nogging');
  const left = noggings.filter((piece) => piece.oMax <= 2050);
  const right = noggings.filter((piece) => piece.oMin >= 2950);

  assert.ok(left.length > 0);
  assert.ok(right.length > 0);
  assert.equal(noggings.length, left.length + right.length);
  assert.ok(noggings.every((piece) => piece.zMin === 2421 && piece.zMax === 2459));
});

test('R3-A: un muro de una sola hilada no genera cadenetas', () => {
  const grid = {
    xAxes: [{ id: 'x0', position: 0 }, { id: 'x1', position: 4000 }],
    yAxes: [{ id: 'y0', position: 0 }],
    zLevels: [{ id: 'z0', elevation: 0 }, { id: 'z1', elevation: 2400 }]
  };
  const wall = {
    id: 'w1',
    type: 'wall',
    direction: 'x',
    xStart: 'x0',
    xEnd: 'x1',
    yStart: 'y0',
    yEnd: 'y0',
    bottomZ: 'z0',
    topZ: 'z1',
    openings: []
  };
  const layout = computeStudLayout(wall, grid, {}, {}, {
    spacing: 400,
    jointZs: computeCourseBreaks(2400, 2440).jointZs,
    flangeWidth: 38
  });
  assert.equal(layout.studs.filter((piece) => piece.role === 'nogging').length, 0);
});

test('R3-A: el batch resuelve el B real aunque los ids seleccionados lleguen como string', () => {
  const grid = {
    xAxes: [{ id: 'x0', position: 0 }, { id: 'x1', position: 4000 }],
    yAxes: [{ id: 'y0', position: 0 }],
    zLevels: [{ id: 'z0', elevation: 0 }, { id: 'z1', elevation: 3000 }]
  };
  const model = {
    grid,
    projectParams: [],
    library: {
      metalconProfiles: [
        { id: 1, shape: 'C', B: 38 },
        { id: 2, shape: 'U', B: 30 }
      ]
    },
    elements: [{
      id: 'w1',
      type: 'wall',
      direction: 'x',
      xStart: 'x0',
      xEnd: 'x1',
      yStart: 'y0',
      yEnd: 'y0',
      bottomZ: 'z0',
      topZ: 'z1',
      openings: []
    }]
  };
  const result = modulateAllWallsFull(model, {
    metalcon: { studProfileId: '1', trackProfileId: '2', spacing: 400 },
    osb: { panelHeight: 2440 }
  });
  const patch = result.patches[0].patch;

  assert.equal(patch.framingStudProfileId, 1);
  assert.equal(patch.framingTrackProfileId, 2);
  assert.ok(patch.studs.some((piece) => piece.role === 'nogging'));
});
