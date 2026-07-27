import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRoofSystemLayout } from '../src/core/trussLayout.js';
import { generateCalculixTruss, subdivideChord, typicalTrussIndex, trussSpacingFromPositions, findTrussProfile } from '../src/core/exportCalculixTruss.js';
import { generateCalculix } from '../src/core/exportCalculix.js';
import { METALCON_PROFILES } from '../src/core/metalconCatalog.js';
import { KGF_TO_N } from '../src/core/calculixCommon.js';

function baseGrid() {
  return {
    xAxes: [{ id: 'x0', position: 0 }, { id: 'x1', position: 8000 }],
    yAxes: [{ id: 'y0', position: 0 }, { id: 'y1', position: 5000 }],
    zLevels: [{ id: 'z0', elevation: 0 }, { id: 'zc', elevation: 2400 }, { id: 'zt', elevation: 4200 }]
  };
}

function loadedProfiles() {
  return METALCON_PROFILES.map((p, i) => ({ ...p, id: 9000 + i }));
}

function supportWall(id, yAxis) {
  return {
    id, type: 'wall', direction: 'x', xStart: 'x0', xEnd: 'x1',
    yStart: yAxis, yEnd: yAxis, bottomZ: 'z0', topZ: 'zt', thickness: 90, openings: []
  };
}

/** Sistema de techumbre resuelto (lo que persiste el modal de techumbre en model.roofSystems). */
function makeRoofSystem(overrides = {}) {
  const grid = baseGrid();
  const elements = [supportWall('wLow', 'y0'), supportWall('wHigh', 'y1')];
  const library = { metalconProfiles: loadedProfiles() };
  const config = {
    id: 'r1', wallLowId: 'wLow', wallHighId: 'wHigh', supportLevelId: 'zc', supportOffset: 100,
    trussSpacing: 1200, slopePercent: 15, heelHeight: 150, gutterNotchWidth: 300,
    postSpacing: 900, diagonalPattern: 'W', purlinSpacing: 800, purlinProfile: '80OMA085',
    profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
    ...overrides
  };
  const layout = computeRoofSystemLayout(config, grid, {}, {}, elements, library);
  assert.equal(layout.resolved, true, 'el layout de techumbre del fixture debe resolver');
  return { system: { ...config, ...layout }, library, grid, elements };
}

/** Líneas de datos que siguen a una directiva, hasta la siguiente que empieza con '*'.
 * Compara la palabra clave completa: '*NODE' no debe capturar el '*NODE FILE' del step. */
function dataLinesAfter(inp, directive) {
  const keyword = (l) => l.split(',')[0].trim().toUpperCase();
  const out = [];
  let capturing = false;
  for (const l of inp.split('\n')) {
    if (l.startsWith('**')) continue;
    if (l.startsWith('*')) { capturing = keyword(l) === directive; continue; }
    if (capturing && l.trim()) out.push(l);
  }
  return out;
}

test('subdivideChord: parte la cuerda en cada punto de llegada y conserva los extremos', () => {
  const chord = { x1: 0, y1: 0, x2: 3000, y2: 0 };
  const segs = subdivideChord(chord, [{ x: 1000, y: 0 }, { x: 2000, y: 0 }, { x: 1500, y: 900 }]);
  assert.equal(segs.length, 3, 'dos cortes válidos generan tres segmentos');
  assert.equal(segs[0].x1, 0);
  assert.equal(segs[2].x2, 3000);
  assert.deepEqual(segs.map(s => Math.round(s.x2)), [1000, 2000, 3000]);
});

test('subdivideChord: ignora puntos fuera de la cuerda y no genera segmentos de largo cero', () => {
  const chord = { x1: 0, y1: 0, x2: 2000, y2: 0 };
  const segs = subdivideChord(chord, [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 1000, y: 500 }, { x: 3000, y: 0 }]);
  assert.equal(segs.length, 1, 'solo los extremos: la cuerda queda entera');
  assert.ok(segs.every(s => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 0.9));
});

test('typicalTrussIndex/trussSpacingFromPositions: cercha central y separación real de las posiciones', () => {
  assert.equal(typicalTrussIndex([{ offset: 0 }, { offset: 1 }, { offset: 2 }]), 1);
  assert.equal(typicalTrussIndex([{ offset: 0 }, { offset: 1 }]), 0);
  // uniformPositions reparte 8000mm con spacing máximo 1200 -> 7 tramos de 1142.86mm
  const { system } = makeRoofSystem();
  assert.ok(Math.abs(trussSpacingFromPositions(system.trussPositions) - 8000 / 7) < 0.01);
});

test('findTrussProfile: resuelve por code (no por id de librería, como sí hacen los muros)', () => {
  const library = { metalconProfiles: loadedProfiles() };
  assert.equal(findTrussProfile(library, '90CA085').H, 90);
  assert.equal(findTrussProfile(library, 'NO_EXISTE'), null);
  assert.equal(findTrussProfile(null, '60CA085').code, '60CA085', 'sin librería cae al catálogo estático');
});

test('generateCalculixTruss: sets por rol, U1 declarado antes de usarse y bloques obligatorios', () => {
  const { system, library } = makeRoofSystem();
  const inp = generateCalculixTruss({ roofSystems: [system], library });

  for (const block of ['*NODE', '*MATERIAL', '*ELASTIC', '*BOUNDARY', '*STEP', '*STATIC', '*CLOAD', '*END STEP']) {
    assert.ok(inp.includes(block), `falta el bloque ${block}`);
  }
  for (const elset of ['CUERDA_SUP', 'CUERDA_INF', 'MONTANTES', 'DIAGONALES']) {
    assert.ok(inp.includes(`ELSET=${elset}`), `falta el ELSET ${elset}`);
    assert.ok(inp.includes(`*BEAM SECTION, ELSET=${elset}`), `falta la sección de ${elset}`);
  }
  // ccx 2.21 solo acepta SECTION=GENERAL sobre U1, y U1 debe declararse antes del primer uso
  assert.ok(!inp.includes('TYPE=B31'), 'no debe quedar ningún B31 con sección GENERAL');
  assert.ok(inp.indexOf('*USER ELEMENT') < inp.indexOf('*ELEMENT, TYPE=U1'));
});

test('generateCalculixTruss: los nudos comparten nodo (cuerdas subdivididas, sin barras sueltas)', () => {
  const { system, library } = makeRoofSystem();
  const inp = generateCalculixTruss({ roofSystems: [system], library });

  const nodeIds = new Set(dataLinesAfter(inp, '*NODE').map(l => Number(l.split(',')[0])));
  const elLines = dataLinesAfter(inp, '*ELEMENT');
  assert.ok(elLines.length > 0);

  const used = new Map();
  for (const l of elLines) {
    const [, n1, n2] = l.split(',').map(v => Number(v.trim()));
    assert.ok(nodeIds.has(n1) && nodeIds.has(n2), 'todo elemento referencia nodos declarados');
    assert.notEqual(n1, n2, 'no debe haber elementos de largo cero');
    used.set(n1, (used.get(n1) || 0) + 1);
    used.set(n2, (used.get(n2) || 0) + 1);
  }
  assert.equal(used.size, nodeIds.size, 'no debe quedar ningún nodo huérfano (ccx: matriz singular)');
  // si las cuerdas no se subdividieran, cada montante quedaría desconectado: los nudos internos
  // tendrían grado 1. Con subdivisión correcta, la mayoría tiene 3+ barras concurrentes.
  const grade3 = [...used.values()].filter(v => v >= 3).length;
  assert.ok(grade3 >= nodeIds.size / 2, `se esperaban nudos con 3+ barras, hubo ${grade3}/${nodeIds.size}`);
});

test('generateCalculixTruss: secciones con A/I reales y I22=Ix (flexión en el plano de la cercha)', () => {
  const { system, library } = makeRoofSystem();
  const inp = generateCalculixTruss({ roofSystems: [system], library });
  const p = METALCON_PROFILES.find(x => x.code === '90CA085'); // cuerdas

  const idx = inp.indexOf('*BEAM SECTION, ELSET=CUERDA_SUP');
  const [propsLine, orientLine] = inp.slice(idx).split('\n').slice(1, 3);
  const [a, i11, i12, i22] = propsLine.split(',').map(Number);
  assert.ok(Math.abs(a - p.areaCm2 * 100) < 0.01, 'área en mm2');
  assert.ok(Math.abs(i11 - p.iyCm4 * 1e4) < 0.1, 'I11 = Iy (flexión fuera del plano)');
  assert.ok(Math.abs(i22 - p.ixCm4 * 1e4) < 0.1, 'I22 = Ix (flexión en el plano)');
  assert.equal(i12, 0, 'ejes principales: I12 = 0');
  // cerchas que corren en X -> plano YZ -> el eje local 1 es la normal X
  assert.deepEqual(orientLine.split(',').map(Number), [1, 0, 0]);
});

test('generateCalculixTruss: carga nodal total = q x area tributaria de la cercha tipo', () => {
  const { system, library } = makeRoofSystem();
  const inp = generateCalculixTruss({ roofSystems: [system], library }, { roofLoadKgfM2: 100 });

  const cloads = dataLinesAfter(inp, '*CLOAD').map(l => l.split(',').map(v => Number(v.trim())));
  assert.ok(cloads.length >= 3);
  assert.ok(cloads.every(c => c[1] === 3 && c[2] < 0), 'carga vertical hacia abajo (GDL 3)');

  const spacing = trussSpacingFromPositions(system.trussPositions);
  const geo = system.trussGeometry;
  const inclLen = geo.purlins[geo.purlins.length - 1].s - geo.purlins[0].s;
  const esperado = 100 * KGF_TO_N * (inclLen * spacing) / 1e6;
  const total = cloads.reduce((s, c) => s + Math.abs(c[2]), 0);
  assert.ok(Math.abs(total - esperado) / esperado < 0.001, `carga total ${total} vs esperada ${esperado}`);
});

test('generateCalculixTruss: modelo plano + apoyo bajo fijo y alto deslizante en la luz', () => {
  const { system, library } = makeRoofSystem();
  const inp = generateCalculixTruss({ roofSystems: [system], library });
  const bcs = dataLinesAfter(inp, '*BOUNDARY').map(l => l.split(',').map(v => Number(v.trim())));

  // cerchas que corren en X: la luz va en Y -> fuera del plano es X (GDL 1)
  const nodeIds = new Set(dataLinesAfter(inp, '*NODE').map(l => Number(l.split(',')[0])));
  for (const id of nodeIds) {
    const dofs = bcs.filter(b => b[0] === id).map(b => b[1]);
    assert.ok(dofs.includes(1), `nodo ${id} sin bloqueo fuera del plano`);
    assert.ok(dofs.includes(5) && dofs.includes(6), `nodo ${id} sin bloqueo de giros fuera del plano`);
    assert.ok(!dofs.includes(4), `nodo ${id}: el giro en el plano debe quedar libre`);
  }
  const restrained = bcs.filter(b => b[1] === 3).map(b => b[0]);
  assert.equal(restrained.length, 2, 'exactamente dos apoyos verticales (isostático)');
  const spanFixed = bcs.filter(b => b[1] === 2).map(b => b[0]);
  assert.equal(spanFixed.length, 1, 'solo el apoyo bajo restringe la dirección de la luz');
  assert.ok(restrained.includes(spanFixed[0]), 'el apoyo fijo también restringe la vertical');
});

test('generateCalculixTruss: sin sistemas resueltos no lanza y deja constancia en el .inp', () => {
  const inp = generateCalculixTruss({ roofSystems: [], library: {} });
  assert.ok(inp.includes('nada que exportar'));
  const sinGeo = generateCalculixTruss({ roofSystems: [{ id: 'r9' }], library: {} });
  assert.ok(sinGeo.includes('ADVERTENCIA'), 'debe advertir el sistema sin geometría generada');
});

test('generateCalculix: las cerchas se integran al MISMO .inp del modelo', () => {
  const { system, library, grid, elements } = makeRoofSystem();
  const inp = generateCalculix({ grid, elements, library, roofSystems: [system], projectParams: [] });
  assert.ok(inp.includes('ELSET=CUERDA_SUP'), 'el .inp general debe traer los elementos de cercha');
  assert.ok(inp.includes('ELSET=DIAGONALES'));
  assert.ok(inp.indexOf('*USER ELEMENT') < inp.indexOf('*ELEMENT, TYPE=U1'));
  assert.ok(!inp.includes('*STEP'), 'el .inp general sigue siendo geométrico: sin step ni cargas');
});
