// core/build3d.js
// Convención: mundo plano (x,y) -> three.js (X, Z); elevación (nuestro z) -> three.js Y (arriba).
import { resolveWallGeometry, resolveColumnGeometry, resolveBeamGeometry, isWallXRun } from './elementGeometry.js';
import { resolveValue, buildParamsMap } from './projectParams.js';
import { resolveFoundation } from './foundationGeometry.js';
import { buildElementsById } from './elementReferences.js';
import { edgeChordMembers } from './roofObstructions.js';
import { memberOffsetMode } from './trussLayout.js';
import { getRoofSystems, getRoofPurlinBoxes } from './roofPlaneOutputs.js';

/** Cajas de muro: eje mayor según dirección (X-run o Y-run), alineadas con los ejes (sin rotación). */
export function buildWallBoxes(model) {
  const { elements, grid } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  const boxes = [];
  for (const el of elements) {
    if (el.type !== 'wall') continue;
    const geo = resolveWallGeometry(el, grid, paramsMap, elementsById);
    const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
    const top = grid.zLevels.find(l => l.id === el.topZ);
    if (!geo || !bottom || !top) continue;
    const isXRun = isWallXRun(el);
    const height = Math.abs(top.elevation - bottom.elevation);
    const midY = (top.elevation + bottom.elevation) / 2;

    if (isXRun) {
      const len = Math.abs(geo.p2.x - geo.p1.x);
      boxes.push({
        id: el.id,
        center: { x: (geo.p1.x + geo.p2.x) / 2, y: midY, z: geo.p1.y },
        size: { x: len, y: height, z: geo.thickness }
      });
    } else {
      const len = Math.abs(geo.p2.y - geo.p1.y);
      boxes.push({
        id: el.id,
        center: { x: geo.p1.x, y: midY, z: (geo.p1.y + geo.p2.y) / 2 },
        size: { x: geo.thickness, y: height, z: len }
      });
    }
  }
  return boxes;
}

/** Cajas de vano (puerta/ventana) en el mismo sistema de coordenadas 3D que buildWallBoxes,
 *  sobredimensionadas en el espesor para garantizar un corte limpio con CSG. */
export function buildWallOpeningBoxes(wall, grid, paramsMap = {}, elementsById = {}) {
  const geo = resolveWallGeometry(wall, grid, paramsMap, elementsById);
  const bottom = grid.zLevels.find(l => l.id === wall.bottomZ);
  const top = grid.zLevels.find(l => l.id === wall.topZ);
  if (!geo || !bottom || !top) return [];
  const isXRun = isWallXRun(wall);
  const cutThickness = geo.thickness * 3; // de sobra para atravesar el muro completo

  return (wall.openings || []).map(o => {
    const oWidth = resolveValue(o.width, paramsMap);
    const oHeight = resolveValue(o.height, paramsMap);
    const oSillHeight = o.sillHeight != null ? resolveValue(o.sillHeight, paramsMap) : 0;
    const sill = o.type === 'door' ? 0 : oSillHeight;
    const vBottom = bottom.elevation + sill;
    const vCenter = vBottom + oHeight / 2;

    if (isXRun) {
      return { openingId: o.id, center: { x: o.position, y: vCenter, z: geo.p1.y }, size: { x: oWidth, y: oHeight, z: cutThickness } };
    }
    return { openingId: o.id, center: { x: geo.p1.x, y: vCenter, z: o.position }, size: { x: cutThickness, y: oHeight, z: oWidth } };
  });
}

/** Igual que buildWallBoxes, pero cada elemento incluye también sus cajas de vano (para restar con CSG). */
export function buildWallBoxesWithOpenings(model) {
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(model.elements);
  return buildWallBoxes(model).map(box => {
    const wall = model.elements.find(el => el.id === box.id);
    return { ...box, openings: wall ? buildWallOpeningBoxes(wall, model.grid, paramsMap, elementsById) : [] };
  });
}
export function buildColumnBoxes(model) {
  const { elements, grid } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  const boxes = [];
  for (const el of elements) {
    if (el.type !== 'column') continue;
    const geo = resolveColumnGeometry(el, grid, paramsMap, elementsById);
    const bottom = grid.zLevels.find(l => l.id === el.bottomZ);
    const top = grid.zLevels.find(l => l.id === el.topZ);
    if (!geo || !bottom || !top) continue;
    const height = Math.abs(top.elevation - bottom.elevation);
    const midY = (top.elevation + bottom.elevation) / 2;
    boxes.push({
      id: el.id,
      center: { x: geo.center.x, y: midY, z: geo.center.y },
      size: { x: geo.w, y: height, z: geo.h }
    });
  }
  return boxes;
}

export function buildBeamBoxes(model) {
  const { elements, grid } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  const boxes = [];
  for (const el of elements) {
    if (el.type !== 'beam') continue;
    const geo = resolveBeamGeometry(el, grid, paramsMap, elementsById);
    const level = grid.zLevels.find(l => l.id === el.levelZ);
    if (!geo || !level) continue;
    const beamHeight = el.height != null ? resolveValue(el.height, paramsMap, elementsById) : 500;
    const midY = level.elevation + beamHeight / 2; // la viga cuelga bajo el nivel del piso
    if (el.direction === 'x') {
      const len = Math.abs(geo.p2.x - geo.p1.x);
      boxes.push({ id: el.id, center: { x: (geo.p1.x + geo.p2.x) / 2, y: midY, z: geo.p1.y }, size: { x: len, y: beamHeight, z: geo.width } });
    } else {
      const len = Math.abs(geo.p2.y - geo.p1.y);
      boxes.push({ id: el.id, center: { x: geo.p1.x, y: midY, z: (geo.p1.y + geo.p2.y) / 2 }, size: { x: geo.width, y: beamHeight, z: len } });
    }
  }
  return boxes;
}

export function buildFoundationBoxes(model) {
  const { elements, grid } = model;
  const paramsMap = buildParamsMap(model.projectParams);
  const elementsById = buildElementsById(elements);
  const boxes = [];
  for (const el of elements) {
    if (el.type !== 'foundation') continue;
    const f = resolveFoundation(el, grid, paramsMap, elementsById);
    if (!f) continue;

    // Una caja por capa (cimiento / sobrecimiento / zapata) + emplantillado si existe.
    const layers = [...f.layers];
    if (f.emplantillado) {
      layers.push({
        name: 'emplantillado',
        width: (f.kind === 'aislada' ? f.lengthX : f.width) + 2 * f.emplantillado.overhang,
        height: f.emplantillado.thickness,
        top: f.emplantillado.top, bottom: f.emplantillado.bottom
      });
    }

    for (const l of layers) {
      if (!(l.height > 0)) continue;
      const midY = (l.top + l.bottom) / 2;
      if (f.kind === 'aislada') {
        const extra = l.name === 'emplantillado' ? 2 * f.emplantillado.overhang : 0;
        boxes.push({
          id: el.id, foundationType: el.foundationType, layer: l.name,
          center: { x: f.center.x, y: midY, z: f.center.y },
          size: { x: f.lengthX + extra, y: l.height, z: f.lengthY + extra }
        });
      } else if (el.direction === 'x') {
        const len = Math.abs(f.p2.x - f.p1.x);
        boxes.push({
          id: el.id, foundationType: el.foundationType, layer: l.name,
          center: { x: (f.p1.x + f.p2.x) / 2, y: midY, z: f.p1.y },
          size: { x: len, y: l.height, z: l.width }
        });
      } else {
        const len = Math.abs(f.p2.y - f.p1.y);
        boxes.push({
          id: el.id, foundationType: el.foundationType, layer: l.name,
          center: { x: f.p1.x, y: midY, z: (f.p1.y + f.p2.y) / 2 },
          size: { x: l.width, y: l.height, z: len }
        });
      }
    }
  }
  return boxes;
}

// ---- techumbre: cerchas + costaneras (model.roofSystems — core/trussLayout.js) --------------
// Cada miembro de cada cercha es una barra p1→p2 en coordenadas three ({x, y=elevación, z}),
// con su sección {h, b} sacada del perfil Metalcon de la librería (fallback 90x40). El mundo
// local de la cercha: x_local avanza desde la cara interior del frontón bajo hacia el alto
// (sentido spanDir sobre el eje perpendicular a runAxis), y_local sobre supportElevation.

function profileDims(library, code, fallback = { h: 90, b: 40 }) {
  const p = (library?.metalconProfiles || []).find(pr => pr.code === code);
  return p ? { h: p.H || fallback.h, b: p.B || fallback.b } : fallback;
}

function trussLocalToThree(system, trussOffset, xLocal, yLocal) {
  const spanDir = system.spanDir ?? 1;
  const base = system.trussPositions?.[0]; // todas comparten la coordenada perpendicular de arranque
  // world del punto x_local=0 de ESTA cercha: la posición guardada trae {offset, world}
  const along = trussOffset; // coordenada a lo largo de runAxis
  const perp0 = system.runAxis === 'x' ? base.world.y : base.world.x;
  const perp = perp0 + spanDir * xLocal;
  const wx = system.runAxis === 'x' ? along : perp;
  const wy = system.runAxis === 'x' ? perp : along;
  return { x: wx, y: system.supportElevation + yLocal, z: wy };
}

/** ★ B4.7.8-s4 (C-01) — La línea de una barra NO es su eje.
 * El 2D (DXF + canvas de elevación) dibuja con `memberRectCorners(..., memberOffsetMode(role))`:
 * para las cuerdas la línea es una CARA del perfil ('plus' = cara inferior/de apoyo, 'minus' =
 * cara superior/de costanera), no su centro. El visor centra la caja en el eje que recibe, así
 * que el desplazamiento se hace acá, en coordenadas LOCALES de la cercha y con la misma normal
 * que usa `memberRectCorners` (n = (−dy, dx)/len). Reusamos `memberOffsetMode` para que 2D y 3D
 * no puedan divergir. Sin esto la cuerda inferior se hundía h/2 bajo la cota de apoyo (chocando
 * con la solera de A-01) y la costanera quedaba embebida en la cuerda superior. */
function memberAxisLocal(m, h) {
  const mode = memberOffsetMode(m.role);
  if (mode === 'center') return { x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2 };
  const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
  const len = Math.hypot(dx, dy) || 1;
  const s = (mode === 'plus' ? 1 : -1) * (h / 2);
  const ox = (-dy / len) * s, oy = (dx / len) * s;
  return { x1: m.x1 + ox, y1: m.y1 + oy, x2: m.x2 + ox, y2: m.y2 + oy };
}

/** Miembros de todas las cerchas de todos los sistemas: [{systemId, role, profile, p1, p2, h, b}]. */
export function buildRoofTrussMembers(model) {
  const out = [];
  for (const system of getRoofSystems(model)) {
    const geo = system.trussGeometry;
    if (!geo?.resolved || !system.trussPositions?.length) continue;
    for (const tp of system.trussPositions) {
      // Sesión 25: una posición `edgeChord` no es una cercha — es la cuerda superior atornillada
      // a la cara del frontón. Dibujar la celosía completa ahí mostraba material inexistente
      // (y antes quedaba escondida DENTRO del muro, que era el bug original).
      const members = tp.kind === 'edgeChord' ? edgeChordMembers(geo) : geo.members;
      for (const m of members) {
        const dims = profileDims(model.library, m.profile);
        const ax = memberAxisLocal(m, dims.h); // ★ s4 C-01: eje real, no la línea de dibujo
        out.push({
          systemId: system.id, role: m.role, profile: m.profile, kind: tp.kind || 'full',
          p1: trussLocalToThree(system, tp.offset, ax.x1, ax.y1),
          p2: trussLocalToThree(system, tp.offset, ax.x2, ax.y2),
          h: dims.h, b: dims.b
        });
      }
    }
  }
  return out;
}

/** ★ B4.7.8-s3 (B.1) — Cajas de las soleras de apoyo lateral. Hasta ahora nadie las dibujaba (ni
 * faldón ni legacy): estaban en el metrado y en el .inp, pero no en el 3D.
 *
 * Convención vertical (A-01): `topElevation` (o el alias legacy `elevation`) es la CARA SUPERIOR
 * de la solera = cara inferior de la cuerda inferior. La pieza cuelga hacia abajo, ocupando
 * [base, top], dentro de la holgura del cielo falso.
 * @returns Array<{ systemId, wallId, side, profile, center:{x,y,z}, size:{x,y,z} }>
 */
export function buildSupportLedgerBoxes(model) {
  const boxes = [];
  for (const system of getRoofSystems(model)) {
    const spanDir = system.spanDir ?? 1;
    for (const led of system.supportLedgers || []) {
      if (!led.p1 || !led.p2) continue;
      const dims = profileDims(model.library, led.profile);
      // ★ s5-C — shape único: los dos emisores traen top/base, y getRoofSystems normaliza los
      // ledgers persistidos con el alias `elevation`. Acá ya no hay dos idiomas que reconciliar.
      const top = led.topElevation;
      const base = led.baseElevation;
      if (top == null || base == null) continue;
      const h = top - base;
      if (!(h > 0)) continue;
      const len = Math.abs(led.runAxis === 'x' ? led.p2.x - led.p1.x : led.p2.y - led.p1.y);
      if (!(len > 0)) continue;
      // ★ B4.7.8-s4 (Parte B) — `led.perp` es la CARA interior del muro, no el eje de la solera.
      // En obra la pieza va atornillada contra esa cara, del lado del recinto: ocupa
      // [perpInner, perpInner + spanDir·B] en el apoyo bajo y [perpHighInner − spanDir·B,
      // perpHighInner] en el alto. Centrarla en la cara la dejaba mitad embutida en el muro.
      const sideDir = led.side === 'low' ? 1 : led.side === 'high' ? -1 : 0;
      const off = sideDir * spanDir * dims.b / 2;
      const along = { x: (led.p1.x + led.p2.x) / 2, y: (led.p1.y + led.p2.y) / 2 };
      const cx = led.runAxis === 'x' ? along.x : along.x + off;
      const cz = led.runAxis === 'x' ? along.y + off : along.y;
      boxes.push({
        systemId: system.id, wallId: led.wallId, side: led.side, profile: led.profile || null,
        center: { x: cx, y: base + h / 2, z: cz },
        size: led.runAxis === 'x' ? { x: len, y: h, z: dims.b } : { x: dims.b, y: h, z: len }
      });
    }
  }
  return boxes;
}

/** Costaneras como cajas continuas de la primera a la última cercha (corren a lo largo de
 * runAxis, apoyadas SOBRE la cuerda superior — se levantan h/2 del plano de techo). */
export function buildRoofPurlinBoxes(model) {
  const boxes = [];
  // Faldones (B4.7): costaneras continuas por la corrida, ya calculadas en world. Los sistemas
  // expandidos traen geo.purlins=[] a propósito, así que el bucle legacy de abajo no las duplica.
  for (const b of getRoofPurlinBoxes(model)) boxes.push(b);
  // ★ B4.7.8-s2 — getRoofSystems, no model.roofSystems: con faldones vivos los sistemas
  // expandidos traen geo.purlins=[] y este bucle se salta solo; con legacy se comporta igual.
  for (const system of getRoofSystems(model)) {
    const geo = system.trussGeometry;
    if (!geo?.resolved || !system.trussPositions?.length || !geo.purlins?.length) continue;
    const from = system.trussPositions[0].offset;
    const to = system.trussPositions[system.trussPositions.length - 1].offset;
    const len = Math.abs(to - from);
    if (!(len > 0)) continue;
    const mid = (from + to) / 2;
    for (const p of geo.purlins) {
      const dims = profileDims(model.library, p.profile, { h: 35, b: 40 });
      const c = trussLocalToThree(system, mid, p.x, p.y + dims.h / 2);
      boxes.push({
        systemId: system.id, profile: p.profile,
        center: c,
        size: system.runAxis === 'x' ? { x: len, y: dims.h, z: dims.b } : { x: dims.b, y: dims.h, z: len }
      });
    }
  }
  return boxes;
}
