import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROLE_TAG,
  generateFramingDxf,
  osbEntities,
  wallFramingEntities
} from '../src/core/exportFramingDxf.js';
import { modulateAllWallsFull } from '../src/core/batchModulation.js';
import { legendEntities } from '../src/core/sheetLegend.js';
import { sheetLayout } from '../src/core/sheetFormats.js';
import {
  drawStudLayoutElevation
} from '../src/render/metalconModulation.js';
import { drawOsbLayoutElevation } from '../src/render/osbModulation.js';
import { drawWallStudsElevation } from '../src/render/wall.js';

const grid = {
  xAxes: [{ id: 'x0', position: 0, label: '1' }, { id: 'x1', position: 400, label: '2' }],
  yAxes: [{ id: 'y0', position: 0, label: 'A' }],
  zLevels: [{ id: 'z0', elevation: 0, label: 'NPT' }, { id: 'z1', elevation: 3000, label: 'CIELO' }]
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
  openings: [],
  studSpacing: 400
};

const verticalStuds = [
  { offset: 0, zMin: 0, zMax: 3000, role: 'edge' },
  { offset: 400, zMin: 0, zMax: 3000, role: 'edge' }
];
const nogging = { oMin: 38, oMax: 362, zMin: 2421, zMax: 2459, role: 'nogging' };
const layout = {
  resolved: true,
  studs: [...verticalStuds, nogging],
  headers: [],
  length: 400,
  wallHeight: 3000,
  wallBottomElevation: 0
};
const studProfile = { id: 1, B: 38 };
const trackProfile = { id: 2, H: 92 };

const casaL = JSON.parse(
  readFileSync(new URL('./fixtures/casa-L.json', import.meta.url), 'utf8')
);

function mockCanvasContext() {
  const fills = [];
  let fillStyle = '#000';
  return {
    fills,
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    strokeRect() {},
    setLineDash() {},
    fillText() {},
    set fillStyle(value) { fillStyle = value; },
    get fillStyle() { return fillStyle; },
    set strokeStyle(_value) {},
    set lineWidth(_value) {},
    set font(_value) {},
    fillRect(x, y, width, height) {
      fills.push({ x, y, width, height, fillStyle });
    }
  };
}

test('R3-B: DXF dibuja la cadeneta con su rectángulo real en MONTANTES y la rotula CD', () => {
  const entities = wallFramingEntities(
    { ...wall, studs: layout.studs, headers: [] },
    grid,
    layout,
    studProfile,
    trackProfile,
    0,
    { axes: [] },
    { includeAxes: false, includeLevels: false, includeCotas: false }
  );
  const content = entities.join('\n');
  const cadeneta = entities.find((entity) => (
    entity.startsWith('0\nPOLYLINE\n8\nMONTANTES')
    && entity.includes('\n10\n38.00\n')
    && entity.includes('\n10\n362.00\n')
    && entity.includes('\n20\n2421.00\n')
    && entity.includes('\n20\n2459.00\n')
  ));

  assert.ok(cadeneta, 'falta la banda real [38,362]x[2421,2459]');
  assert.equal(ROLE_TAG.nogging, 'CD');
  assert.match(content, /\n1\nCD$/m);
  assert.doesNotMatch(content, /NaN/);
});

test('R3-B: las 493 piezas de casa-L llegan al plano R12 con rótulo CD', () => {
  const regeneration = modulateAllWallsFull(casaL, {
    metalcon: casaL.metalconDefaults || {},
    osb: casaL.osbDefaults || {}
  });
  const patches = new Map(
    regeneration.patches.map(({ wallId, patch }) => [String(wallId), patch])
  );
  const model = {
    ...casaL,
    elements: casaL.elements.map((element) => (
      patches.has(String(element.id))
        ? { ...element, ...patches.get(String(element.id)) }
        : element
    ))
  };
  const content = generateFramingDxf(model);

  assert.equal((content.match(/\n1\nCD(?:\n|$)/g) || []).length, 493);
  assert.doesNotMatch(content, /NaN/);
});

test('R3-B: un muro sin cadeneta no emite el rótulo CD', () => {
  const entities = wallFramingEntities(
    { ...wall, studs: verticalStuds, headers: [] },
    grid,
    { ...layout, studs: verticalStuds },
    studProfile,
    trackProfile,
    0,
    { axes: [] },
    { includeAxes: false, includeLevels: false, includeCotas: false }
  );
  assert.doesNotMatch(entities.join('\n'), /\n1\nCD$/m);
});

test('R3-B: la salida OSB usa wall.studs, centra la banda y condiciona la nota a piezas reales', () => {
  const courses = [
    { zMin: 0, zMax: 2440, panels: [{ start: 0, end: 400, cutouts: [] }] },
    { zMin: 2440, zMax: 3000, panels: [{ start: 0, end: 400, cutouts: [] }] }
  ];
  const withPiece = osbEntities(0, 400, 3000, courses, 5, layout.studs).join('\n');
  const withoutPiece = osbEntities(0, 400, 3000, courses, 5, verticalStuds).join('\n');

  assert.match(withPiece, /CADENETA \+ HUINCHA/);
  assert.match(withPiece, /8\nMONTANTES/);
  assert.match(withPiece, /20\n2421\.00/);
  assert.match(withPiece, /20\n2459\.00/);
  assert.doesNotMatch(withPiece, /NaN/);
  assert.doesNotMatch(withoutPiece, /CADENETA \+ HUINCHA/);
});

test('R3-B: canvas principal y preview Metalcon dibujan la misma banda horizontal de 38 mm', () => {
  const principal = mockCanvasContext();
  drawWallStudsElevation(
    principal,
    { ...wall, studs: layout.studs, headers: [] },
    grid,
    { axis: 'y' },
    { offsetX: 0, offsetY: 0, scale: 1 },
    0,
    studProfile
  );
  const principalBand = principal.fills.find((rect) => (
    Math.abs(rect.width - 324) < 0.01 && Math.abs(rect.height - 38) < 0.01
  ));
  assert.ok(principalBand, 'la elevación principal no dibujó la pieza horizontal real');
  assert.ok(principal.fills.every((rect) => Object.values(rect).every((value) => (
    typeof value !== 'number' || Number.isFinite(value)
  ))));

  const preview = mockCanvasContext();
  drawStudLayoutElevation(preview, layout, 456, 305, 28);
  const scale = Math.min(400 / 400, 249 / 3000);
  const previewBand = preview.fills.find((rect) => (
    Math.abs(rect.width - 324 * scale) < 0.01
    && Math.abs(rect.height - 38 * scale) < 0.01
  ));
  assert.ok(previewBand, 'el preview Metalcon no dibujó la banda centrada');
});

test('R3-B: preview OSB consume las piezas reales y no una altura visual inventada', () => {
  const courses = [
    { zMin: 0, zMax: 2440, panels: [{ start: 0, end: 400, cutouts: [] }] },
    { zMin: 2440, zMax: 3000, panels: [{ start: 0, end: 400, cutouts: [] }] }
  ];
  const ctx = mockCanvasContext();
  drawOsbLayoutElevation(
    ctx,
    { courses, length: 400, wallHeight: 3000, studs: layout.studs },
    456,
    305,
    { gap: 5 },
    28
  );
  const scale = Math.min(400 / 400, 249 / 3000);
  const band = ctx.fills.find((rect) => (
    Math.abs(rect.width - 324 * scale) < 0.01
    && Math.abs(rect.height - 38 * scale) < 0.01
  ));
  assert.ok(band, 'el preview OSB no usa zMin/zMax de la cadeneta real');
});

test('R3-B: la leyenda A3 incorpora CD = Cadeneta sin truncar simbología', () => {
  const content = legendEntities(
    sheetLayout('A3'),
    'framing',
    ['D1 = MURO EJE A', 'D2 = MURO EJE B']
  ).join('\n');
  assert.match(content, /CD = Cadeneta/);
  assert.doesNotMatch(content, /\(\.\.\.\)/);
});

test('R3-B: desaparece la constante gráfica de 60 mm', () => {
  const source = readFileSync(
    new URL('../src/core/exportFramingDxf.js', import.meta.url),
    'utf8'
  );
  assert.ok(!source.includes(['NOGGING', '_H'].join('')));
});
