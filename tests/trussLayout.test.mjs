// tests/trussLayout.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMonoTrussGeometry, computeRoofSystemLayout, computeSlopeFromClearance,
  assignTrussPieceCodes, computeTrussCutSpec, buildTrussPieceScheduleRows, validateRoofSystems
} from '../src/core/trussLayout.js';
import { SEED_TRUSS_TEMPLATES, mergeSeedTemplates } from '../src/core/trussTemplates.js';

const near = (a, b, tol = 0.5) => Math.abs(a - b) < tol;

test('trussLayout: geometría básica — alturas según pendiente y talón', () => {
  const g = computeMonoTrussGeometry({ span: 4000, slopePercent: 30, heelHeight: 200, postSpacing: 600 });
  assert.ok(g.resolved);
  assert.ok(near(g.heightLow, 200));
  assert.ok(near(g.heightHigh, 200 + 4000 * 0.30)); // 1400
  const top = g.members.find(m => m.role === 'topChord');
  assert.ok(near(top.x1, 0) && near(top.y1, 200));
  assert.ok(near(top.x2, 4000) && near(top.y2, 1400));
  const bottom = g.members.find(m => m.role === 'bottomChord');
  assert.ok(near(bottom.y1, 0) && near(bottom.y2, 0));
});

test('trussLayout: rebaje de canaleta — vano rectangular libre hasta la cuerda inferior, cuerda superior remata en el borde', () => {
  const g = computeMonoTrussGeometry({ span: 4000, slopePercent: 30, heelHeight: 200, gutterNotchWidth: 300, postSpacing: 600 });
  assert.ok(g.resolved);
  // sin gutterChord ni ninguna pieza dentro del vano [0..300]
  assert.equal(g.members.filter(m => m.role === 'gutterChord').length, 0);
  for (const m of g.members) {
    if (m.role === 'bottomChord') continue; // el fondo del vano ES la cuerda inferior
    const minX = Math.min(m.x1, m.x2), maxX = Math.max(m.x1, m.x2);
    assert.ok(maxX >= 300 - 0.5, `ninguna pieza (${m.role}) invade el vano de canaleta`);
    if (minX < 300 - 0.5) assert.ok(false, `pieza ${m.role} arranca dentro del vano`);
  }
  // la cuerda superior remata exactamente en el borde del rebaje
  const top = g.members.find(m => m.role === 'topChord');
  assert.ok(near(top.x1, 300));
  assert.ok(near(top.y1, 200 + 300 * 0.30)); // 290
  // cierre vertical en el borde, de cuerda inferior a cuerda superior
  const closePost = g.members.find(m => m.role === 'post' && near(m.x1, 300));
  assert.ok(closePost && near(closePost.y1, 0) && near(closePost.y2, 290));
  // rectángulo del vano expuesto para preview/DXF
  assert.ok(g.gutterNotch && near(g.gutterNotch.width, 300) && near(g.gutterNotch.height, 290));
});

test('trussLayout: montantes — reparto uniforme, todos entre cuerdas (0 ≤ y ≤ plano de techo)', () => {
  const g = computeMonoTrussGeometry({ span: 5000, slopePercent: 40, heelHeight: 150, postSpacing: 600 });
  const posts = g.members.filter(m => m.role === 'post');
  assert.ok(posts.length >= Math.floor(5000 / 600), 'suficientes montantes para el spacing');
  for (const p of posts) {
    assert.ok(near(p.x1, p.x2), 'montante vertical');
    assert.ok(near(p.y1, 0) || near(p.x1, 0), 'base en cuerda inferior (salvo montante de talón)');
    const yTop = 150 + 0.40 * p.x2;
    assert.ok(p.y2 <= yTop + 0.5, 'cabeza no sobrepasa el plano de techo');
  }
  // el spacing efectivo nunca supera el pedido
  const xs = posts.map(p => p.x1).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] <= 600 + 0.5);
});

test('trussLayout: diagonales W conectan nodos de montantes consecutivos', () => {
  const g = computeMonoTrussGeometry({ span: 3600, slopePercent: 30, heelHeight: 200, postSpacing: 900, diagonalPattern: 'W' });
  const diags = g.members.filter(m => m.role === 'diagonal');
  assert.ok(diags.length > 0);
  const postXs = new Set(g.members.filter(m => m.role === 'post').map(m => Math.round(m.x1)));
  postXs.add(0); // talón: si heel>0 hay post en 0; con notch=0 la cuerda superior también arranca en 0
  for (const d of diags) {
    assert.ok(postXs.has(Math.round(d.x1)) && postXs.has(Math.round(d.x2)), 'diagonal ancla en líneas de montante');
  }
});

test('trussLayout: diagonalPattern none — sin diagonales', () => {
  const g = computeMonoTrussGeometry({ span: 3600, slopePercent: 30, heelHeight: 200, postSpacing: 900, diagonalPattern: 'none' });
  assert.equal(g.members.filter(m => m.role === 'diagonal').length, 0);
});

test('trussLayout: costaneras — spacing inclinado como máximo, extremos incluidos, sobre el plano de techo', () => {
  const g = computeMonoTrussGeometry({ span: 4000, slopePercent: 30, heelHeight: 200, postSpacing: 600, purlinSpacing: 800, purlinProfile: '35OMA085' });
  assert.ok(g.purlins.length >= 2);
  assert.ok(near(g.purlins[0].x, 0));
  assert.ok(near(g.purlins[g.purlins.length - 1].x, 4000));
  for (const p of g.purlins) {
    assert.ok(near(p.y, 200 + 0.30 * p.x), 'costanera sobre la cuerda superior');
    assert.equal(p.profile, '35OMA085');
  }
  for (let i = 1; i < g.purlins.length; i++) {
    assert.ok(g.purlins[i].s - g.purlins[i - 1].s <= 800 + 0.5, 'spacing inclinado no supera el máximo');
  }
});

test('trussLayout: perfiles por rol desde la plantilla', () => {
  const tpl = SEED_TRUSS_TEMPLATES[1]; // Estándar 130
  const g = computeMonoTrussGeometry({ span: 4000, slopePercent: 30, heelHeight: 200, postSpacing: tpl.postSpacing, profiles: tpl.profiles });
  assert.equal(g.members.find(m => m.role === 'topChord').profile, '90CA085');
  assert.equal(g.members.find(m => m.role === 'bottomChord').profile, '90CA085');
  assert.equal(g.members.find(m => m.role === 'diagonal').profile, '60CA085');
});

test('trussLayout: inválidos — span 0, pendiente 0, rebaje ≥ luz', () => {
  assert.equal(computeMonoTrussGeometry({ span: 0, slopePercent: 30 }).resolved, false);
  assert.equal(computeMonoTrussGeometry({ span: 4000, slopePercent: 0 }).resolved, false);
  assert.equal(computeMonoTrussGeometry({ span: 4000, slopePercent: 30, gutterNotchWidth: 4000 }).resolved, false);
});

// ---- sistema entre dos frontones ------------------------------------------------------------

const systemFixture = () => {
  const grid = {
    xAxes: [{ id: 'X1', position: 0 }, { id: 'X2', position: 6000 }],
    yAxes: [{ id: 'Y1', position: 0 }, { id: 'Y2', position: 4090 }],
    zLevels: [{ id: 'Z0', elevation: 0 }, { id: 'Z1', elevation: 2400 }]
  };
  // dos muros xRun paralelos, espesor 90 → luz entre caras interiores = 4090 - 45 - 45 = 4000
  const wallLow = { id: 1, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y1', yEnd: 'Y1', bottomZ: 'Z0', topZ: 'Z1', thickness: 90 };
  const wallHigh = { id: 2, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y2', yEnd: 'Y2', bottomZ: 'Z0', topZ: 'Z1', thickness: 90 };
  return { grid, elements: [wallLow, wallHigh] };
};

test('roofSystem: luz entre caras interiores y cerchas repartidas @spacing en el solapamiento', () => {
  const { grid, elements } = systemFixture();
  const layout = computeRoofSystemLayout(
    { wallLowId: 1, wallHighId: 2, slopePercent: 30, heelHeight: 200, trussSpacing: 1200, postSpacing: 600 },
    grid, {}, {}, elements
  );
  assert.ok(layout.resolved);
  assert.ok(near(layout.span, 4000));
  assert.equal(layout.supportElevation, 2400);
  assert.equal(layout.runAxis, 'x');
  // solapamiento 0..6000 @1200 → 5 intervalos → 6 cerchas
  assert.equal(layout.trussPositions.length, 6);
  assert.ok(near(layout.trussPositions[0].offset, 0));
  assert.ok(near(layout.trussPositions[5].offset, 6000));
  for (let i = 1; i < layout.trussPositions.length; i++) {
    assert.ok(layout.trussPositions[i].offset - layout.trussPositions[i - 1].offset <= 1200 + 0.5);
  }
});

test('roofSystem: muros no paralelos → no resuelve con aviso claro', () => {
  const { grid, elements } = systemFixture();
  elements[1] = { ...elements[1], direction: 'y', xStart: 'X1', xEnd: 'X1', yStart: 'Y1', yEnd: 'Y2' };
  const layout = computeRoofSystemLayout({ wallLowId: 1, wallHighId: 2, slopePercent: 30 }, grid, {}, {}, elements);
  assert.equal(layout.resolved, false);
  assert.ok(layout.warnings[0].includes('paralelos'));
});

test('roofSystem: apoyo = nivel de cielo + offset (100mm default)', () => {
  const { grid, elements } = systemFixture();
  grid.zLevels.push({ id: 'ZC', elevation: 2150, levelType: 'cieloGeneral', label: 'Cielo' });
  const layout = computeRoofSystemLayout(
    { wallLowId: 1, wallHighId: 2, slopePercent: 3, heelHeight: 100, trussSpacing: 1200, supportLevelId: 'ZC' },
    grid, {}, {}, elements
  );
  assert.ok(layout.resolved);
  assert.equal(layout.supportElevation, 2250); // 2150 + 100
});

test('roofSystem: sin nivel de cielo → fallback al nivel superior del muro con aviso', () => {
  const { grid, elements } = systemFixture();
  const layout = computeRoofSystemLayout({ wallLowId: 1, wallHighId: 2, slopePercent: 3, trussSpacing: 1200 }, grid, {}, {}, elements);
  assert.ok(layout.resolved);
  assert.equal(layout.supportElevation, 2400);
  assert.ok(layout.warnings.some(w => w.includes('sin nivel de cielo')));
});

test('roofSystem: coronación — punto más alto + costanera respeta clearance o marca heightViolation', () => {
  const { grid, elements } = systemFixture();
  // cielo 2150 + 100 = apoyo 2250 · frontón (topZ del muro alto) 2900 · clearance 200 → máx 2700
  grid.zLevels.push({ id: 'ZC', elevation: 2150, levelType: 'cieloGeneral' });
  grid.zLevels.push({ id: 'ZF', elevation: 2900, levelType: 'frontonAlto' });
  elements[1] = { ...elements[1], topZ: 'ZF' };
  const library = { metalconProfiles: [{ code: '35OMA085', H: 35, B: 40 }] };
  const base = { wallLowId: 1, wallHighId: 2, heelHeight: 100, trussSpacing: 1200, supportLevelId: 'ZC', purlinProfile: '35OMA085', purlinSpacing: 800 };

  // pendiente 7%: alto extremo = 100 + 4000*0.07 = 380 → tope 2250+380+35 = 2665 ≤ 2700 → OK
  const ok = computeRoofSystemLayout({ ...base, slopePercent: 7 }, grid, {}, {}, elements, library);
  assert.ok(ok.resolved);
  assert.equal(ok.heightViolation, false);

  // pendiente 10%: alto = 100 + 400 = 500 → tope 2250+500+35 = 2785 > 2700 → violación
  const bad = computeRoofSystemLayout({ ...base, slopePercent: 10 }, grid, {}, {}, elements, library);
  assert.ok(bad.resolved, 'sigue resolviendo para poder ver el preview');
  assert.equal(bad.heightViolation, true);
  assert.ok(bad.warnings.some(w => w.includes('supera el máximo permitido')));
});

test('trussTemplates: mergeSeedTemplates no duplica ni pisa plantillas de usuario', () => {
  const user = [{ id: 'mia', name: 'Mi plantilla', postSpacing: 400, diagonalPattern: 'W', profiles: {} }];
  const merged = mergeSeedTemplates(user);
  assert.equal(merged.length, 1 + SEED_TRUSS_TEMPLATES.length);
  assert.equal(merged[0].id, 'mia');
  const again = mergeSeedTemplates(merged);
  assert.equal(again.length, merged.length, 'segundo merge no agrega nada');
});

// ---- 3D + DXF ------------------------------------------------------------------------------
import { buildRoofTrussMembers, buildRoofPurlinBoxes } from '../src/core/build3d.js';
import { generateTrussDxf } from '../src/core/exportTrussDxf.js';

const modelWithSystem = () => {
  const { grid, elements } = systemFixture();
  const layout = computeRoofSystemLayout(
    { wallLowId: 1, wallHighId: 2, slopePercent: 30, heelHeight: 200, gutterNotchWidth: 300,
      trussSpacing: 1200, postSpacing: 600, purlinProfile: '35OMA085', purlinSpacing: 800,
      profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' } },
    grid, {}, {}, elements
  );
  const system = {
    id: 100, wallLowId: 1, wallHighId: 2, slopePercent: 30, heelHeight: 200, gutterNotchWidth: 300,
    trussSpacing: 1200, postSpacing: 600, purlinProfile: '35OMA085', purlinSpacing: 800,
    profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '60CA085' },
    span: layout.span, supportElevation: layout.supportElevation, runAxis: layout.runAxis,
    spanDir: layout.spanDir, trussPositions: layout.trussPositions, trussGeometry: layout.trussGeometry
  };
  return { grid, elements, roofSystems: [system], library: { metalconProfiles: [
    { code: '90CA085', H: 90, B: 38 }, { code: '40CA085', H: 40, B: 40 },
    { code: '60CA085', H: 60, B: 38 }, { code: '35OMA085', H: 35, B: 40 }
  ] }, projectParams: [] };
};

test('build3d: miembros de cercha en coordenadas three — apoyo en cota correcta y dentro de la luz', () => {
  const model = modelWithSystem();
  const members = buildRoofTrussMembers(model);
  const nTrusses = model.roofSystems[0].trussPositions.length;
  const perTruss = model.roofSystems[0].trussGeometry.members.length;
  assert.equal(members.length, nTrusses * perTruss);
  for (const m of members) {
    // cota de apoyo 2400: nada bajo ella
    assert.ok(m.p1.y >= 2400 - 0.5 && m.p2.y >= 2400 - 0.5);
    // runAxis 'x': el plano de la cercha es x=const → p1.x === p2.x
    assert.ok(near(m.p1.x, m.p2.x));
    // z local recorre desde la cara interior del muro bajo (y=45) hacia el alto (y=45+4000)
    assert.ok(m.p1.z >= 45 - 0.5 && m.p1.z <= 4045 + 0.5);
  }
  // sección tomada de la librería
  const top = members.find(m => m.role === 'topChord');
  assert.equal(top.h, 90);
  assert.equal(top.b, 38);
});

test('build3d: costaneras corren de la primera a la última cercha, sobre el plano de techo', () => {
  const model = modelWithSystem();
  const purlins = buildRoofPurlinBoxes(model);
  assert.equal(purlins.length, model.roofSystems[0].trussGeometry.purlins.length);
  for (const p of purlins) {
    assert.ok(near(p.size.x, 6000), 'largo = solapamiento de frontones'); // runAxis x
    assert.ok(near(p.size.y, 35), 'alto = H del perfil OMA');
    assert.ok(p.center.y > 2400, 'sobre la cota de apoyo');
  }
});

test('exportTrussDxf: genera DXF con capas de cercha, cotas y resumen; null sin sistemas', () => {
  const model = modelWithSystem();
  const dxf = generateTrussDxf(model);
  assert.ok(dxf, 'con sistema debe generar');
  assert.ok(dxf.includes('CERCHA-CUERDAS'));
  assert.ok(dxf.includes('CERCHA-ENTRAMADO'));
  assert.ok(dxf.includes('COSTANERAS'));
  assert.ok(dxf.includes('CERCHA TIPO'));
  assert.ok(dxf.includes('rebaje canaleta 300mm'));
  assert.ok(dxf.endsWith('EOF'));
  assert.equal(generateTrussDxf({ roofSystems: [] }), null);
});

// ---- rectángulo real de perfil (contorno) — sin enterrar/sobrepasar límites ------------------
import { memberRectCorners, resolveTrussProfileDims, memberOffsetMode } from '../src/core/trussLayout.js';

test('memberRectCorners: cuerda inferior — la línea es la cara INFERIOR, el perfil sube (no enterrado bajo el apoyo)', () => {
  const H = 90;
  const corners = memberRectCorners(0, 0, 4000, 0, H, memberOffsetMode('bottomChord'));
  const ys = corners.map(c => c.y);
  assert.ok(near(Math.min(...ys), 0), 'la cara inferior coincide exacto con la línea (cota de apoyo)');
  assert.ok(near(Math.max(...ys), H), 'el perfil sube su H completo, nada bajo la línea (no enterrado)');
});

test('memberRectCorners: cuerda superior — la línea es la cara SUPERIOR, el perfil baja (no sobrepasa la altura límite)', () => {
  const H = 90;
  const corners = memberRectCorners(300, 290, 4000, 1400, H, memberOffsetMode('topChord'));
  // proyectar cada esquina sobre la normal de la cuerda para verificar que ninguna supera la línea
  const dx = 4000 - 300, dy = 1400 - 290, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len; // misma normal que memberRectCorners
  // signed distance de cada esquina a la recta que pasa por (x1,y1) con normal (nx,ny)
  const dist = (p) => (p.x - 300) * nx + (p.y - 290) * ny;
  for (const c of corners) assert.ok(dist(c) <= 0.01, 'ninguna esquina sobrepasa la cara superior (la línea)');
  // y al menos una esquina toca exacto la línea (dist ~ 0) y otra está a -H (dist ~ -H)
  const dists = corners.map(dist).map(d => Math.round(d));
  assert.ok(dists.includes(0));
  assert.ok(dists.includes(-H));
});

test('memberRectCorners: entramado — centrado en la línea (mitad a cada lado, se superpone con las cuerdas en los nudos, igual que montante/solera)', () => {
  const H = 40;
  const corners = memberRectCorners(1000, 0, 1000, 500, H, memberOffsetMode('post'));
  const xs = corners.map(c => Math.round(c.x));
  assert.ok(xs.includes(1000 - H / 2) && xs.includes(1000 + H / 2), 'mitad del espesor a cada lado del eje del montante');
});

test('resolveTrussProfileDims: toma H/B de la librería del proyecto; fallback si no está', () => {
  const library = { metalconProfiles: [{ code: '90CA085', H: 90, B: 38 }] };
  assert.deepEqual(resolveTrussProfileDims(library, '90CA085', 40, 40), { h: 90, b: 38 });
  assert.deepEqual(resolveTrussProfileDims(library, 'NOEXISTE', 40, 40), { h: 40, b: 40 });
  assert.deepEqual(resolveTrussProfileDims(null, '90CA085', 40, 40), { h: 40, b: 40 });
});

test('exportTrussDxf: cada miembro se exporta como POLYLINE cerrada (rectángulo real), no como línea de eje', () => {
  const model = modelWithSystem();
  const dxf = generateTrussDxf(model);
  // al menos tantas POLYLINE como miembros de cercha + costaneras (más las del vano/marco de láminas si las hubiera)
  const polylineCount = (dxf.match(/0\nPOLYLINE/g) || []).length;
  const nMembers = model.roofSystems[0].trussGeometry.members.length;
  const nPurlins = model.roofSystems[0].trussGeometry.purlins.length;
  assert.ok(polylineCount >= nMembers + nPurlins, 'cada miembro y cada costanera aporta su propia polilínea cerrada');
});

// --- Sesión 5: códigos de barra + despiece con descuento de peralte ---

const truss05Fixture = () => {
  const geo = computeMonoTrussGeometry({
    span: 4910, slopePercent: 15, heelHeight: 0, gutterNotchWidth: 300, postSpacing: 900,
    profiles: { topChord: '90CA085', bottomChord: '90CA085', post: '40CA085', diagonal: '40CA085' },
    purlinSpacing: 800, purlinProfile: '35CA085'
  });
  const library = {
    metalconProfiles: [
      { code: '90CA085', H: 90, B: 40 },
      { code: '40CA085', H: 40, B: 20 },
      { code: '35CA085', H: 35, B: 35 }
    ]
  };
  return { geo, library };
};

test('assignTrussPieceCodes: correlativo izquierda→derecha, cuerdas únicas, monta números sin huecos tras omitir degeneradas', () => {
  const { geo, library } = truss05Fixture();
  const { codes, warnings } = assignTrussPieceCodes(geo, library);
  assert.equal(codes.get(geo.members.find(m => m.role === 'bottomChord')), 'C.I.1');
  assert.equal(codes.get(geo.members.find(m => m.role === 'topChord')), 'C.S.1');
  const postCodes = geo.members.filter(m => m.role === 'post' && codes.has(m))
    .sort((a, b) => a.x1 - b.x1).map(m => codes.get(m));
  assert.deepEqual(postCodes, ['M1', 'M2', 'M3', 'M4', 'M5']); // M en x=300 y x=1068 omitidos (ver warnings)
  assert.ok(warnings.length === 2, 'dos montantes cercanos al rebaje quedan bajo el mínimo fabricable');
  assert.ok(warnings.every(w => w.includes('mínimo fabricable')));
});

test('computeTrussCutSpec: montante interno descuenta peralte de ambas cuerdas; cuerda superior a plomo (90-θ)', () => {
  const { geo, library } = truss05Fixture();
  const post = geo.members.find(m => m.role === 'post' && Math.abs(m.x1 - 1837) < 1); // M3
  const cut = computeTrussCutSpec(post, geo, library);
  const slopeFrac = (geo.heightHigh - geo.heightLow) / geo.span; // 0.15
  const cosTheta = 1 / Math.sqrt(1 + slopeFrac * slopeFrac);
  const yTopX = geo.heightLow + slopeFrac * 1837;
  const expected = (yTopX - 90 / cosTheta) - 90; // h_cs=90, h_ci=90
  assert.ok(Math.abs(cut.length - expected) < 0.5);
  assert.ok(Math.abs(cut.angA - 90) < 0.01 && Math.abs(cut.angB - 90) < 0.01);

  const topChord = geo.members.find(m => m.role === 'topChord');
  const topCut = computeTrussCutSpec(topChord, geo, library);
  const thetaDeg = Math.atan(slopeFrac) * 180 / Math.PI;
  assert.ok(Math.abs(topCut.angA - (90 - thetaDeg)) < 0.01);
  assert.ok(Math.abs(topCut.angB - (90 - thetaDeg)) < 0.01);
});

test('buildTrussPieceScheduleRows: n filas = n barras fabricables (+1 CST si hay costaneras), sin largos negativos', () => {
  const { geo, library } = truss05Fixture();
  const rows = buildTrussPieceScheduleRows(geo, library, 1200);
  const { codes } = assignTrussPieceCodes(geo, library);
  assert.equal(rows.length, codes.size + (geo.purlins.length ? 1 : 0));
  for (const row of rows) {
    const largo = Number(row[2]);
    assert.ok(largo > 0, `largo debe ser positivo: ${row.join(' | ')}`);
  }
  const cstRow = rows.find(r => r[0] === 'CST');
  assert.ok(cstRow);
  assert.equal(cstRow[2], '1200');
  assert.equal(cstRow[5], String(geo.purlins.length));
});

// ---- computeSlopeFromClearance (sesión 09, tarea B) --------------------------------------

test('computeSlopeFromClearance: sin costanera — pendiente exacta para tocar la holgura', () => {
  // span 4000, supportElev 2250, heel 100, crownElev 2900, clearance 200 → maxAllowed 2700
  // availableRise = 2700 - 2250 - 100 - 0 = 350 → slope% = 350/4000*100 = 8.75
  const r = computeSlopeFromClearance({ span: 4000, heelHeight: 100, supportElev: 2250, crownElev: 2900, crownClearance: 200 });
  assert.ok(r.valid);
  assert.ok(near(r.slopePercent, 8.75, 0.01));
  // round-trip: la geometría con esa pendiente toca EXACTO el máximo permitido
  const g = computeMonoTrussGeometry({ span: 4000, slopePercent: r.slopePercent, heelHeight: 100 });
  const topmost = 2250 + g.heightHigh;
  assert.ok(near(topmost, 2700, 0.5));
});

test('computeSlopeFromClearance: con costanera — descuenta purlinHeight de la holgura disponible', () => {
  // mismo caso anterior + costanera H=35 → availableRise = 350 - 35 = 315 → slope% = 7.875
  const r = computeSlopeFromClearance({ span: 4000, heelHeight: 100, supportElev: 2250, crownElev: 2900, crownClearance: 200, purlinHeight: 35 });
  assert.ok(r.valid);
  assert.ok(near(r.slopePercent, 7.875, 0.01));
  const g = computeMonoTrussGeometry({ span: 4000, slopePercent: r.slopePercent, heelHeight: 100 });
  const topmost = 2250 + g.heightHigh + 35;
  assert.ok(near(topmost, 2700, 0.5));
});

test('computeSlopeFromClearance: holgura 0 (clearance consume toda la holgura) → pendiente 0, inválida', () => {
  // maxAllowed = supportElev + heel exacto → availableRise = 0
  const r = computeSlopeFromClearance({ span: 4000, heelHeight: 100, supportElev: 2250, crownElev: 2450, crownClearance: 100 });
  assert.ok(near(r.slopePercent, 0));
  assert.equal(r.valid, false);
});

test('computeSlopeFromClearance: resultado ≤ 0 (talón ya excede la holgura) → invalid con warning', () => {
  const r = computeSlopeFromClearance({ span: 4000, heelHeight: 500, supportElev: 2250, crownElev: 2900, crownClearance: 200 });
  assert.equal(r.valid, false);
  assert.ok(r.slopePercent < 0);
  assert.ok(r.warnings.length > 0);
});

test('computeSlopeFromClearance: span ≤ 0 o cotas no resueltas → invalid con warning claro', () => {
  assert.equal(computeSlopeFromClearance({ span: 0, supportElev: 100, crownElev: 200 }).valid, false);
  assert.equal(computeSlopeFromClearance({ span: 4000, supportElev: null, crownElev: 200 }).valid, false);
  assert.equal(computeSlopeFromClearance({ span: 4000, supportElev: 100, crownElev: undefined }).valid, false);
});

// ---- roofSystem con slopeMode: 'auto' -----------------------------------------------------

test('roofSystem: slopeMode auto — pendiente calculada, sin heightViolation por construcción', () => {
  const { grid, elements } = systemFixture();
  grid.zLevels.push({ id: 'ZC', elevation: 2150, levelType: 'cieloGeneral' });
  grid.zLevels.push({ id: 'ZF', elevation: 2900, levelType: 'frontonAlto' });
  elements[1] = { ...elements[1], topZ: 'ZF' };
  const library = { metalconProfiles: [{ code: '35OMA085', H: 35, B: 40 }] };
  const system = {
    wallLowId: 1, wallHighId: 2, slopeMode: 'auto', heelHeight: 100, trussSpacing: 1200,
    supportLevelId: 'ZC', purlinProfile: '35OMA085', purlinSpacing: 800, crownClearance: 200
  };
  const layout = computeRoofSystemLayout(system, grid, {}, {}, elements, library);
  assert.ok(layout.resolved);
  assert.equal(layout.heightViolation, false);
  assert.ok(layout.slopePercent > 0);
  // apoyo 2250 (2150+100) · tope permitido 2900-200=2700 · costanera H=35
  const topmost = layout.supportElevation + layout.trussGeometry.heightHigh + 35;
  assert.ok(near(topmost, 2700, 0.5), `punto más alto (${topmost}) debe tocar la coronación-holgura (2700) ±0.5mm`);
});

test('roofSystem: slopeMode auto vs manual — cambiar talón/holgura recalcula la pendiente en vivo', () => {
  const { grid, elements } = systemFixture();
  grid.zLevels.push({ id: 'ZC', elevation: 2150, levelType: 'cieloGeneral' });
  grid.zLevels.push({ id: 'ZF', elevation: 2900, levelType: 'frontonAlto' });
  elements[1] = { ...elements[1], topZ: 'ZF' };
  const base = { wallLowId: 1, wallHighId: 2, slopeMode: 'auto', trussSpacing: 1200, supportLevelId: 'ZC' };

  const a = computeRoofSystemLayout({ ...base, heelHeight: 100, crownClearance: 200 }, grid, {}, {}, elements);
  const b = computeRoofSystemLayout({ ...base, heelHeight: 300, crownClearance: 200 }, grid, {}, {}, elements);
  assert.ok(b.slopePercent < a.slopePercent, 'más talón → menos pendiente disponible bajo la misma coronación');
});

test('roofSystem: slopeMode ausente (sistemas antiguos) → manual, usa system.slopePercent sin cambio', () => {
  const { grid, elements } = systemFixture();
  const layout = computeRoofSystemLayout({ wallLowId: 1, wallHighId: 2, slopePercent: 25, trussSpacing: 1200 }, grid, {}, {}, elements);
  assert.ok(layout.resolved);
  assert.equal(layout.slopePercent, 25);
});

// ---- validación de sistemas multi-sistema (sesión 10) ---------------------------------------

/** Genera un sistema PERSISTIDO (con trussPositions/trussGeometry) igual que hace el modal al
 * generar, para probar validateRoofSystems sobre datos ya guardados. */
function generateSystem(id, config, grid, elements) {
  const layout = computeRoofSystemLayout(config, grid, {}, {}, elements);
  return {
    id, ...config,
    slopePercent: layout.slopePercent, span: layout.span, supportElevation: layout.supportElevation,
    runAxis: layout.runAxis, spanDir: layout.spanDir, trussPositions: layout.trussPositions,
    trussGeometry: layout.trussGeometry
  };
}

test('validateRoofSystems: sin sistemas → sin findings', () => {
  const { grid, elements } = systemFixture();
  assert.deepEqual(validateRoofSystems({ grid, elements, roofSystems: [] }), []);
});

test('validateRoofSystems: dos sistemas con huellas superpuestas → finding overlap', () => {
  const { grid, elements } = systemFixture();
  const base = { wallLowId: 1, wallHighId: 2, slopePercent: 30, heelHeight: 200, trussSpacing: 1200, postSpacing: 600 };
  const sysA = generateSystem('A', base, grid, elements);
  const sysB = generateSystem('B', base, grid, elements); // mismos muros → misma huella exacta
  const findings = validateRoofSystems({ grid, elements, roofSystems: [sysA, sysB] });
  assert.ok(findings.some(f => f.category === 'overlap' && f.roofSystemIds.includes('A') && f.roofSystemIds.includes('B')));
});

test('validateRoofSystems: dos sistemas adyacentes sin solape → sin finding overlap', () => {
  const { grid, elements } = systemFixture();
  // segundo par de muros paralelos más allá (Y3/Y4), sin relación geométrica con el primero
  grid.yAxes.push({ id: 'Y3', position: 8000 }, { id: 'Y4', position: 12090 });
  const wallLow2 = { id: 3, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y3', yEnd: 'Y3', bottomZ: 'Z0', topZ: 'Z1', thickness: 90 };
  const wallHigh2 = { id: 4, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y4', yEnd: 'Y4', bottomZ: 'Z0', topZ: 'Z1', thickness: 90 };
  elements.push(wallLow2, wallHigh2);
  const base = { slopePercent: 30, heelHeight: 200, trussSpacing: 1200, postSpacing: 600 };
  const sysA = generateSystem('A', { ...base, wallLowId: 1, wallHighId: 2 }, grid, elements);
  const sysB = generateSystem('B', { ...base, wallLowId: 3, wallHighId: 4 }, grid, elements);
  const findings = validateRoofSystems({ grid, elements, roofSystems: [sysA, sysB] });
  assert.ok(!findings.some(f => f.category === 'overlap'));
});

test('validateRoofSystems: cercha fuera del solape actual de sus muros → orphanTruss', () => {
  const { grid, elements } = systemFixture();
  const base = { wallLowId: 1, wallHighId: 2, slopePercent: 30, heelHeight: 200, trussSpacing: 1200, postSpacing: 600 };
  const sys = generateSystem('A', base, grid, elements);
  assert.equal(sys.trussPositions.at(-1).offset, 6000); // solape original 0..6000
  // el muro alto se acorta después de generar → esa última cercha queda huérfana
  elements[1] = { ...elements[1], xEnd: 'X1' === elements[1].xStart ? elements[1].xStart : 'X1' };
  const shrunk = elements.map(e => e.id === 2 ? { ...e, xStart: 'X1', xEnd: 'X1' } : e);
  const findings = validateRoofSystems({ grid, elements: shrunk, roofSystems: [sys] });
  assert.ok(findings.some(f => f.category === 'orphanTruss' && f.roofSystemIds.includes('A')));
});

test('validateRoofSystems: sistemas adyacentes (comparten muro) con talón distinto → mismatchedEdge', () => {
  const { grid, elements } = systemFixture();
  grid.yAxes.push({ id: 'Y3', position: 8090 });
  const wallHigh2 = { id: 3, type: 'wall', direction: 'x', xStart: 'X1', xEnd: 'X2', yStart: 'Y3', yEnd: 'Y3', bottomZ: 'Z0', topZ: 'Z1', thickness: 90 };
  elements.push(wallHigh2);
  // sysA: muro 2 (Y2) como wallHigh · sysB: muro 2 (Y2) como wallLow, muro 3 (Y3) como wallHigh → comparten muro 2
  const sysA = generateSystem('A', { wallLowId: 1, wallHighId: 2, slopePercent: 30, heelHeight: 200, trussSpacing: 1200 }, grid, elements);
  const sysBmismatch = generateSystem('B', { wallLowId: 2, wallHighId: 3, slopePercent: 30, heelHeight: 350, trussSpacing: 1200 }, grid, elements);
  const findings = validateRoofSystems({ grid, elements, roofSystems: [sysA, sysBmismatch] });
  assert.ok(findings.some(f => f.category === 'mismatchedEdge' && f.roofSystemIds.includes('A') && f.roofSystemIds.includes('B')));

  const sysBmatch = generateSystem('B', { wallLowId: 2, wallHighId: 3, slopePercent: 30, heelHeight: 200, trussSpacing: 1200 }, grid, elements);
  const findingsOk = validateRoofSystems({ grid, elements, roofSystems: [sysA, sysBmatch] });
  assert.ok(!findingsOk.some(f => f.category === 'mismatchedEdge'));
});

// ---- sesión 17: apoyo en frontón (rango vertical del muro + apoyo lateral) --------------------

/** Fixture del caso problemático: el muro ALTO es un frontón puro que arranca en el cielo
 * (2600) y llega a 3400 — la cota de apoyo (cielo general 2400 + 100) queda BAJO su arranque. */
const frontonFixture = () => {
  const { grid, elements } = systemFixture();
  grid.zLevels.push({ id: 'ZC', elevation: 2400, levelType: 'cieloGeneral' });
  grid.zLevels.push({ id: 'ZCA', elevation: 2600, levelType: 'cieloAlto' });
  grid.zLevels.push({ id: 'ZFA', elevation: 3400, levelType: 'frontonAlto' });
  elements[0] = { ...elements[0], topZ: 'ZCA' };                 // muro bajo: llega al cielo alto
  elements[1] = { ...elements[1], bottomZ: 'ZCA', topZ: 'ZFA' }; // muro alto: solo frontón
  const base = { wallLowId: 1, wallHighId: 2, slopePercent: 3, heelHeight: 100,
    trussSpacing: 1200, supportLevelId: 'ZC', supportOffset: 100 };
  return { grid, elements, base };
};

test('roofSystem/17: coronación — muro solo-frontón que arranca sobre la cota de apoyo → violación', () => {
  const { grid, elements, base } = frontonFixture();
  const layout = computeRoofSystemLayout(base, grid, {}, {}, elements);
  assert.ok(layout.resolved, 'sigue resolviendo para poder ver el preview');
  assert.equal(layout.supportElevation, 2500);
  assert.equal(layout.supportViolation, true);
  assert.ok(layout.warnings.some(w => w.includes('no llega a la cota de apoyo') && w.includes('alto')));
  assert.deepEqual(layout.supportLedgers, []);
});

test('roofSystem/17: apoyo lateral — se relaja la violación y se registra la solera', () => {
  const { grid, elements, base } = frontonFixture();
  const layout = computeRoofSystemLayout(
    { ...base, supportMode: 'lateral', profiles: { bottomChord: '90CA085' } }, grid, {}, {}, elements
  );
  assert.equal(layout.supportViolation, false);
  assert.equal(layout.supportMode, 'lateral');
  assert.ok(layout.warnings.some(w => w.includes('apoyo lateral') && w.includes('solera')));
  assert.equal(layout.supportLedgers.length, 2);
  for (const led of layout.supportLedgers) {
    assert.equal(led.profile, '90CA085'); // fallback: cuerda inferior
    assert.equal(led.topElevation, 2500);      // ★ s5-C — cara superior; el alias `elevation` ya no se emite
    assert.equal(led.elevation, undefined);
    assert.ok(near(led.length, 6000)); // solape completo de los dos muros
    assert.equal(led.runAxis, 'x');
  }
  // cada solera va sobre la cara interior de su muro (bajo y=45, alto y=4045)
  assert.ok(near(layout.supportLedgers[0].p1.y, 45));
  assert.ok(near(layout.supportLedgers[1].p1.y, 4045));
});

test('roofSystem/17: cota de apoyo sobre la coronación → violación también en lateral', () => {
  const { grid, elements } = systemFixture();
  grid.zLevels.push({ id: 'ZALTO', elevation: 3000 });
  const base = { wallLowId: 1, wallHighId: 2, slopePercent: 3, trussSpacing: 1200, supportLevelId: 'ZALTO', supportOffset: 0 };
  for (const mode of ['coronacion', 'lateral']) {
    const layout = computeRoofSystemLayout({ ...base, supportMode: mode }, grid, {}, {}, elements);
    assert.equal(layout.supportViolation, true, `modo ${mode}`);
    assert.ok(layout.warnings.some(w => w.includes('SOBRE su coronación')));
  }
});

test('roofSystem/17: caso sano — sin violación y sin soleras en modo coronación', () => {
  const { grid, elements } = systemFixture();
  grid.zLevels.push({ id: 'ZC', elevation: 2150, levelType: 'cieloGeneral' });
  const layout = computeRoofSystemLayout(
    { wallLowId: 1, wallHighId: 2, slopePercent: 3, heelHeight: 100, trussSpacing: 1200, supportLevelId: 'ZC' },
    grid, {}, {}, elements
  );
  assert.equal(layout.supportViolation, false);
  assert.equal(layout.supportMode, 'coronacion');
  assert.deepEqual(layout.supportLedgers, []);
});

test('validateRoofSystems/17: supportOutOfWall en sistema persistido (y no en lateral bajo el arranque)', () => {
  const { grid, elements, base } = frontonFixture();
  const layout = computeRoofSystemLayout(base, grid, {}, {}, elements);
  const sys = { id: 7, ...base, supportElevation: layout.supportElevation, runAxis: layout.runAxis,
    spanDir: layout.spanDir, span: layout.span, trussPositions: layout.trussPositions, trussGeometry: layout.trussGeometry };
  const bad = validateRoofSystems({ grid, elements, roofSystems: [sys] });
  assert.ok(bad.some(f => f.category === 'supportOutOfWall' && f.severity === 'error' && f.roofSystemIds.includes(7)));

  const ok = validateRoofSystems({ grid, elements, roofSystems: [{ ...sys, supportMode: 'lateral' }] });
  assert.equal(ok.filter(f => f.category === 'supportOutOfWall').length, 0);
});
