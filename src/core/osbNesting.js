// core/osbNesting.js
// ★ Sesión 24 — Optimización de despuntes OSB y reporte de compra.
//
// La modulación (core/osbModulation.js) resuelve DÓNDE va cada junta en cada muro, pero cada muro
// se modula aislado: si un muro necesita una placa de 600x2440 se compra una de 1220x2440 y los
// 620 restantes se pierden. Este módulo toma el despiece YA persistido (`wall.osbCourses`) y
// resuelve el problema inverso: de qué placa madre sale cada pieza, reutilizando el despunte de
// una pieza para cortar otra — de cualquier muro del modelo, no solo del mismo.
//
// Es un problema de corte 2D (cutting stock guillotina). Heurística: first-fit decreasing por
// área con cortes guillotina y split SLAS (Shorter Leftover Axis Split). Sin dependencias nuevas.
// No busca el óptimo global (es NP-duro); busca una solución buena, determinista y auditable —
// el instalador tiene que poder seguir el plan de corte placa por placa.
//
// Decisiones tomadas (no reabrir sin motivo):
//   - La rotación depende exclusivamente del rol: sólo `tabique` puede rotar. MP1/MP2/MP3 y los
//     muros legacy sin rol conservan hebra vertical; ningún parámetro del caller puede forzarla.
//   - La pieza se corta al ANCHO NOMINAL del despiece (`panel.width`), sin descontar la dilatación
//     de 5mm de la junta. Es conservador a propósito: el gap se reparte medio a cada lado de la
//     junta (ver osbEntities en exportFramingDxf.js) y descontarlo daría piezas 5mm más chicas de
//     lo que el instalador va a medir en el plano.
//   - El KERF de la sierra sí se descuenta: cada corte consume `kerf` mm (default = la misma
//     dilatación, 5mm). Sin esto el reporte promete placas que en obra no salen.
//   - Los `cutouts` (vacío de vano recortado de una placa) NO se tratan como despunte
//     reutilizable: es un corte interior, no guillotina, y sale en pedazos irregulares. Su área se
//     reporta aparte (`cutoutArea`) como merma conocida.
//   - Muros con distinto tamaño de placa madre se nestean por separado: son SKU distintos.

import { assignOsbPieceCodes } from './osbModulation.js';
import { getElementShortLabel } from './naming.js';
import {
  resolveWallTypeConfig,
  wallRoleAllowsOsbRotation
} from './wallTypes.js';

const EPS = 0.5; // mm
const MM2_TO_M2 = 1e-6;

const DEFAULTS = {
  kerf: 5,              // mm de sierra por corte (= dilatación LP)
  minOffcutWidth: 300,  // mm — bajo esto el despunte se descarta como merma
  minOffcutHeight: 300
};

/**
 * Piezas requeridas por el despiece vigente del modelo, agrupadas por tamaño de placa madre.
 * Cada pieza referencia su muro y su código de despiece (P1, P2...) para poder marcarla después.
 *
 * @returns {{ groups: Array<{key, boardWidth, boardHeight, pieces}>, totalPieces:number }}
 */
export function collectOsbPieces(model, defaults = {}) {
  const grid = model.grid;
  const defW = defaults.panelWidth ?? model.osbDefaults?.panelWidth ?? 1220;
  const defH = defaults.panelHeight ?? model.osbDefaults?.panelHeight ?? 2440;

  const groups = new Map();
  let totalPieces = 0;

  for (const el of model.elements || []) {
    if (el.type !== 'wall' || !el.osbCourses?.length) continue;
    const effective = resolveWallTypeConfig(model, el);
    const boardWidth = Number(
      effective.source === 'wallType'
        ? effective.osbDefaults.panelWidth
        : el.osbPanelWidth ?? defW
    );
    const boardHeight = Number(
      effective.source === 'wallType'
        ? effective.osbDefaults.panelHeight
        : el.osbPanelHeight ?? defH
    );
    if (!(boardWidth > 0) || !(boardHeight > 0)) continue;

    const codes = assignOsbPieceCodes(el.osbCourses);
    const wallLabel = grid ? getElementShortLabel(el, grid) : `Muro ${el.id}`;
    const key = `${Math.round(boardWidth)}x${Math.round(boardHeight)}`;
    if (!groups.has(key)) groups.set(key, { key, boardWidth, boardHeight, pieces: [] });

    el.osbCourses.forEach((course, ci) => {
      for (const p of course.panels) {
        const width = Number(p.width ?? (p.end - p.start));
        const height = Number(course.height ?? (course.zMax - course.zMin));
        if (!(width > EPS) || !(height > EPS)) continue;
        const cutoutArea = (p.cutouts || [])
          .reduce((a, ct) => a + (ct.end - ct.start) * (ct.zMax - ct.zMin), 0);
        groups.get(key).pieces.push({
          id: `${el.id}#${codes.get(p)}`,
          wallId: el.id,
          wallLabel,
          code: codes.get(p),
          course: ci + 1,
          role: effective.role,
          width: Math.round(width * 10) / 10,
          height: Math.round(height * 10) / 10,
          cutoutArea
        });
        totalPieces++;
      }
    });
  }

  return { groups: [...groups.values()], totalPieces };
}

/** ¿La pieza cabe en el rectángulo libre? */
function fits(free, w, h) {
  return w <= free.w + EPS && h <= free.h + EPS;
}

/**
 * Corta `free` tras colocar una pieza w×h en su esquina inferior izquierda, con corte guillotina.
 * Regla SLAS: se parte a lo largo del eje con MENOS sobrante, que es la que deja el rectángulo
 * libre más grande de un lado en vez de dos tiras flacas inservibles.
 */
function splitFree(free, w, h, kerf) {
  const restW = free.w - w - kerf;
  const restH = free.h - h - kerf;
  const out = [];
  if (restW < restH) {
    // corte horizontal primero: el sobrante de arriba conserva todo el ancho
    if (restW > EPS) out.push({ x: free.x + w + kerf, y: free.y, w: restW, h });
    if (restH > EPS) out.push({ x: free.x, y: free.y + h + kerf, w: free.w, h: restH });
  } else {
    // corte vertical primero: el sobrante de la derecha conserva toda la altura
    if (restW > EPS) out.push({ x: free.x + w + kerf, y: free.y, w: restW, h: free.h });
    if (restH > EPS) out.push({ x: free.x, y: free.y + h + kerf, w, h: restH });
  }
  return out;
}

function newBoard(index, boardWidth, boardHeight) {
  return {
    index,
    code: `PL${index}`,
    width: boardWidth,
    height: boardHeight,
    placements: [],
    free: [{ x: 0, y: 0, w: boardWidth, h: boardHeight }]
  };
}

/**
 * Nesting de un conjunto de piezas sobre placas de un mismo tamaño.
 *
 * @param pieces  [{id, width, height, ...}] — no se mutan
 * @param boardWidth,boardHeight  mm
 * @param config  { kerf, minOffcutWidth, minOffcutHeight }
 * @returns { boards, unplaced, config }
 */
export function nestPieces(pieces, boardWidth, boardHeight, config = {}) {
  const cfg = {
    kerf: config.kerf ?? DEFAULTS.kerf,
    minOffcutWidth: config.minOffcutWidth ?? DEFAULTS.minOffcutWidth,
    minOffcutHeight: config.minOffcutHeight ?? DEFAULTS.minOffcutHeight
  };
  if (!(boardWidth > 0) || !(boardHeight > 0)) {
    return { boards: [], unplaced: [...pieces], config: cfg };
  }

  // First-fit DECREASING: por área desc, con desempates fijos (alto, ancho, id) para que el
  // resultado sea idempotente — el mismo modelo debe dar siempre el mismo plan de corte.
  const sorted = [...pieces].sort((a, b) =>
    (b.width * b.height) - (a.width * a.height) ||
    b.height - a.height || b.width - a.width ||
    String(a.id).localeCompare(String(b.id))
  );

  const boards = [];
  const unplaced = [];

  for (const piece of sorted) {
    let placed = false;
    const canRotate = wallRoleAllowsOsbRotation(piece.role ?? null);

    for (const board of boards) {
      // Dentro de la placa se elige el hueco que deja MENOS sobrante (best area fit): first-fit
      // puro entre placas, best-fit dentro de una. Reduce despuntes basura sin perder determinismo.
      let bestIdx = -1, bestWaste = Infinity, bestRot = false;
      board.free.forEach((f, i) => {
        if (fits(f, piece.width, piece.height)) {
          const waste = f.w * f.h - piece.width * piece.height;
          if (waste < bestWaste - EPS) { bestWaste = waste; bestIdx = i; bestRot = false; }
        }
        if (canRotate && fits(f, piece.height, piece.width)) {
          const waste = f.w * f.h - piece.width * piece.height;
          if (waste < bestWaste - EPS) { bestWaste = waste; bestIdx = i; bestRot = true; }
        }
      });
      if (bestIdx < 0) continue;

      const f = board.free[bestIdx];
      const w = bestRot ? piece.height : piece.width;
      const h = bestRot ? piece.width : piece.height;
      board.placements.push({ ...piece, x: f.x, y: f.y, w, h, rotated: bestRot, sourcePanel: board.code });
      board.free.splice(bestIdx, 1, ...splitFree(f, w, h, cfg.kerf));
      placed = true;
      break;
    }

    if (placed) continue;

    // Placa nueva. Si ni siquiera en una placa virgen cabe, la pieza es inviable (mal despiece).
    const board = newBoard(boards.length + 1, boardWidth, boardHeight);
    const rot = canRotate && !fits(board.free[0], piece.width, piece.height)
      && fits(board.free[0], piece.height, piece.width);
    const w = rot ? piece.height : piece.width;
    const h = rot ? piece.width : piece.height;
    if (!fits(board.free[0], w, h)) {
      unplaced.push({ ...piece, reason: `la pieza (${Math.round(piece.width)}x${Math.round(piece.height)}mm) excede la placa de ${Math.round(boardWidth)}x${Math.round(boardHeight)}mm` });
      continue;
    }
    board.placements.push({ ...piece, x: 0, y: 0, w, h, rotated: rot, sourcePanel: board.code });
    board.free = splitFree(board.free[0], w, h, cfg.kerf);
    boards.push(board);
  }

  // Despuntes: lo que queda libre en cada placa. Sobre el mínimo configurable es reutilizable en
  // un próximo proyecto (se guarda en bodega); bajo el mínimo es merma.
  for (const board of boards) {
    board.offcuts = board.free
      .map(f => ({
        x: Math.round(f.x * 10) / 10, y: Math.round(f.y * 10) / 10,
        width: Math.round(f.w * 10) / 10, height: Math.round(f.h * 10) / 10,
        area: f.w * f.h,
        reusable: f.w >= cfg.minOffcutWidth - EPS && f.h >= cfg.minOffcutHeight - EPS
      }))
      .sort((a, b) => b.area - a.area);
    board.usedArea = board.placements.reduce((a, p) => a + p.w * p.h, 0);
    board.wasteArea = boardWidth * boardHeight - board.usedArea;
  }

  return { boards, unplaced, config: cfg };
}

/** Placas necesarias si cada pieza se corta de una placa virgen y todo recorte se pierde
 *  (el comportamiento de hoy: cada muro modulado y comprado aislado). */
function naiveBoardCount(pieces) {
  return pieces.length;
}

function summarize(boards, boardWidth, boardHeight, pieces) {
  const boardArea = boardWidth * boardHeight;
  const boughtArea = boards.length * boardArea;
  const usedArea = boards.reduce((a, b) => a + b.usedArea, 0);
  const cutoutArea = pieces.reduce((a, p) => a + (p.cutoutArea || 0), 0);
  const offcuts = boards.flatMap(b => b.offcuts.map(o => ({ ...o, board: b.code })));
  const reusable = offcuts.filter(o => o.reusable);
  const reusableArea = reusable.reduce((a, o) => a + o.area, 0);
  return {
    boardCount: boards.length,
    boardArea: boardArea * MM2_TO_M2,
    boughtArea: boughtArea * MM2_TO_M2,
    usedArea: usedArea * MM2_TO_M2,
    cutoutArea: cutoutArea * MM2_TO_M2,
    wasteArea: (boughtArea - usedArea) * MM2_TO_M2,
    wastePct: boughtArea > 0 ? (1 - usedArea / boughtArea) * 100 : 0,
    reusableOffcuts: reusable,
    reusableArea: reusableArea * MM2_TO_M2,
    scrapArea: (boughtArea - usedArea - reusableArea) * MM2_TO_M2
  };
}

/**
 * Reporte completo de compra: nesting global (todos los muros comparten despuntes) contra dos
 * líneas base — nesting muro por muro, y el caso de hoy (una placa por pieza).
 *
 * @returns {{
 *   groups: Array<{key,boardWidth,boardHeight,boards,unplaced,summary,baselinePerWall,baselineNaive}>,
 *   totals: {boardCount,boughtArea,usedArea,wasteArea,wastePct,reusableArea,scrapArea,cutoutArea},
 *   baseline: {perWallBoards, naiveBoards},
 *   savings: {boards, pct, vsNaive},
 *   unplaced: Array
 * }}
 */
export function computeOsbNesting(model, config = {}) {
  const { groups } = collectOsbPieces(model, config);
  const outGroups = [];

  for (const g of groups) {
    const { boards, unplaced } = nestPieces(g.pieces, g.boardWidth, g.boardHeight, config);

    // Baseline: mismo algoritmo pero sin compartir despuntes entre muros. Es la comparación
    // honesta — mide exactamente lo que aporta esta sesión, no el desorden previo.
    const byWall = new Map();
    for (const p of g.pieces) {
      if (!byWall.has(p.wallId)) byWall.set(p.wallId, []);
      byWall.get(p.wallId).push(p);
    }
    let perWallBoards = 0;
    for (const wallPieces of byWall.values()) {
      perWallBoards += nestPieces(wallPieces, g.boardWidth, g.boardHeight, config).boards.length;
    }

    outGroups.push({
      key: g.key, boardWidth: g.boardWidth, boardHeight: g.boardHeight,
      boards, unplaced,
      summary: summarize(boards, g.boardWidth, g.boardHeight, g.pieces),
      baselinePerWall: perWallBoards,
      baselineNaive: naiveBoardCount(g.pieces)
    });
  }

  const totals = outGroups.reduce((t, g) => ({
    boardCount: t.boardCount + g.summary.boardCount,
    boughtArea: t.boughtArea + g.summary.boughtArea,
    usedArea: t.usedArea + g.summary.usedArea,
    cutoutArea: t.cutoutArea + g.summary.cutoutArea,
    wasteArea: t.wasteArea + g.summary.wasteArea,
    reusableArea: t.reusableArea + g.summary.reusableArea,
    scrapArea: t.scrapArea + g.summary.scrapArea,
    wastePct: 0
  }), { boardCount: 0, boughtArea: 0, usedArea: 0, cutoutArea: 0, wasteArea: 0, reusableArea: 0, scrapArea: 0, wastePct: 0 });
  totals.wastePct = totals.boughtArea > 0 ? (1 - totals.usedArea / totals.boughtArea) * 100 : 0;

  const perWallBoards = outGroups.reduce((a, g) => a + g.baselinePerWall, 0);
  const naiveBoards = outGroups.reduce((a, g) => a + g.baselineNaive, 0);

  return {
    groups: outGroups,
    totals,
    baseline: { perWallBoards, naiveBoards },
    savings: {
      boards: perWallBoards - totals.boardCount,
      pct: perWallBoards > 0 ? ((perWallBoards - totals.boardCount) / perWallBoards) * 100 : 0,
      vsNaive: naiveBoards - totals.boardCount
    },
    unplaced: outGroups.flatMap(g => g.unplaced)
  };
}

/**
 * Patches por muro que anotan en cada placa del despiece de qué placa madre sale (`sourcePanel`)
 * y en qué posición (`sourceXY`). Con esto el DXF puede rotular "P3 — de PL2" y el instalador
 * sabe qué cortar de dónde. No recalcula la modulación: solo agrega campos.
 *
 * @returns Array<{wallId, patch: {osbCourses}}> — formato de store.applyWallPatchesBatch
 */
export function buildNestingPatches(model, result) {
  const byPieceId = new Map();
  for (const g of result.groups) {
    for (const b of g.boards) {
      for (const p of b.placements) byPieceId.set(p.id, { sourcePanel: b.code, x: p.x, y: p.y, rotated: p.rotated });
    }
  }

  const patches = [];
  for (const el of model.elements || []) {
    if (el.type !== 'wall' || !el.osbCourses?.length) continue;
    const codes = assignOsbPieceCodes(el.osbCourses);
    let changed = false;
    const osbCourses = el.osbCourses.map(course => ({
      ...course,
      panels: course.panels.map(p => {
        const hit = byPieceId.get(`${el.id}#${codes.get(p)}`);
        if (!hit) return p;
        if (p.sourcePanel === hit.sourcePanel && p.sourceXY?.x === hit.x && p.sourceXY?.y === hit.y) return p;
        changed = true;
        return { ...p, sourcePanel: hit.sourcePanel, sourceXY: { x: hit.x, y: hit.y } };
      })
    }));
    if (changed) patches.push({ wallId: el.id, patch: { osbCourses } });
  }
  return patches;
}

const fmt2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

/**
 * Filas del reporte de compra, listas para tabla en pantalla o CSV.
 * @returns Array<{label, value, note}>
 */
export function buildPurchaseReportRows(result) {
  const rows = [];
  for (const g of result.groups) {
    const s = g.summary;
    rows.push({ label: `Placas ${g.key} mm`, value: String(s.boardCount), note: `${fmt2(s.boughtArea)} m² comprados` });
    rows.push({ label: '  m² efectivamente usados', value: fmt2(s.usedArea), note: `pérdida ${fmt2(s.wastePct)} %` });
    rows.push({ label: '  despuntes reutilizables', value: String(s.reusableOffcuts.length), note: `${fmt2(s.reusableArea)} m² recuperables` });
    rows.push({ label: '  merma no recuperable', value: fmt2(s.scrapArea), note: 'm² bajo el mínimo de despunte' });
    if (s.cutoutArea > 0) {
      rows.push({ label: '  recorte de vanos', value: fmt2(s.cutoutArea), note: 'm² dentro de piezas ya contadas (corte interior)' });
    }
    rows.push({ label: '  antes (modulando muro por muro)', value: String(g.baselinePerWall), note: `ahorro ${g.baselinePerWall - s.boardCount} placa(s)` });
  }
  if (result.unplaced.length > 0) {
    rows.push({ label: 'Piezas sin asignar', value: String(result.unplaced.length), note: result.unplaced[0].reason });
  }
  return rows;
}

/** Lista de despuntes reutilizables con origen y tamaño, para la bodega / próximo proyecto. */
export function buildOffcutRows(result) {
  const rows = [];
  for (const g of result.groups) {
    for (const o of g.summary.reusableOffcuts) {
      rows.push([o.board, `${Math.round(o.width)}x${Math.round(o.height)}`, `${fmt2(o.area * MM2_TO_M2)} m²`, `${g.key} mm`]);
    }
  }
  return rows;
}

/** Plan de corte por placa: qué piezas salen de cada placa madre y de qué muro son. */
export function buildCutPlanRows(result) {
  const rows = [];
  for (const g of result.groups) {
    for (const b of g.boards) {
      for (const p of b.placements) {
        rows.push([b.code, p.code, p.wallLabel, `${Math.round(p.w)}x${Math.round(p.h)}`, `x=${Math.round(p.x)} y=${Math.round(p.y)}`]);
      }
    }
  }
  return rows;
}
